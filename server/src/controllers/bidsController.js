// server/src/controllers/bidsController.js
// Alekhine — Bid submission, acceptance, and rejection

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBid } from '../utils/validators.js';
import { COMMISSION } from '../utils/constants.js';
import { emailService } from '../services/emailService.js';

// ── POST /api/jobs/:id/bids — Freelancer submits a bid ───────────────────────
export const submitBid = async (req, res, next) => {
  try {
    const { proposedPrice, coverLetter, estimatedDays } = req.body;
    validateBid({ proposedPrice, coverLetter, estimatedDays });

    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { client: { select: { id: true, name: true, email: true } } },
    });
    if (!job) throw new AppError('Job not found.', 404);
    if (job.status !== 'OPEN') throw new AppError('This job is no longer accepting bids.', 400);
    if (job.clientId === req.user.id) throw new AppError('You cannot bid on your own job.', 400);

    // Prevent duplicate bids (DB unique constraint also enforces this)
    const existingBid = await prisma.bid.findUnique({
      where: { jobId_freelancerId: { jobId: job.id, freelancerId: req.user.id } },
    });
    if (existingBid) throw new AppError('You have already submitted a bid for this job.', 409);

    const bid = await prisma.bid.create({
      data: {
        jobId: job.id,
        freelancerId: req.user.id,
        proposedPrice: parseFloat(proposedPrice),
        coverLetter: coverLetter.trim(),
        estimatedDays: parseInt(estimatedDays),
      },
      include: {
        freelancer: {
          select: {
            id: true, name: true, avatarUrl: true, skills: true,
            hourlyRate: true, isVerified: true,
          },
        },
      },
    });

    // Count total bids now and notify the client
    const bidCount = await prisma.bid.count({ where: { jobId: job.id } });
    emailService.sendNewBidReceived({
      to: job.client.email,
      clientName: job.client.name,
      jobTitle: job.title,
      bidCount,
    }).catch(() => {}); // fire-and-forget — email failures must never block the response

    res.status(201).json({ status: 'success', data: { bid } });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/jobs/:id/bids — Client views all bids on their job ───────────────
export const getJobBids = async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw new AppError('Job not found.', 404);

    // Clients see all bids; freelancers only see their own
    const where = { jobId: job.id };
    if (req.user.role === 'FREELANCER') {
      where.freelancerId = req.user.id;
    } else if (req.user.role === 'CLIENT' && job.clientId !== req.user.id) {
      throw new AppError('You are not authorized to view bids for this job.', 403);
    }

    const bids = await prisma.bid.findMany({
      where,
      include: {
        freelancer: {
          select: {
            id: true, name: true, avatarUrl: true, skills: true,
            hourlyRate: true, isVerified: true, subscriptionPlan: true,
            _count: { select: { reviewsReceived: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich each bid with the freelancer's avg rating
    const enriched = await Promise.all(
      bids.map(async (bid) => {
        const agg = await prisma.review.aggregate({
          where: { freelancerId: bid.freelancerId },
          _avg: { rating: true },
        });
        return {
          ...bid,
          freelancer: {
            ...bid.freelancer,
            avgRating: agg._avg.rating
              ? parseFloat(agg._avg.rating.toFixed(2))
              : null,
          },
        };
      })
    );

    res.status(200).json({ status: 'success', data: { bids: enriched } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/bids/:id/accept — Client accepts a bid → creates contract ───────
export const acceptBid = async (req, res, next) => {
  try {
    const bid = await prisma.bid.findUnique({
      where: { id: req.params.id },
      include: { job: true },
    });

    if (!bid) throw new AppError('Bid not found.', 404);
    if (bid.job.clientId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('Only the job owner can accept bids.', 403);
    }
    if (bid.job.status !== 'OPEN') throw new AppError('This job is no longer open.', 400);
    if (bid.status !== 'PENDING') throw new AppError('This bid has already been processed.', 400);

    // Determine commission rate based on freelancer's plan
    const freelancer = await prisma.user.findUnique({
      where: { id: bid.freelancerId },
      select: { subscriptionPlan: true, name: true, email: true },
    });
    const commissionRate = COMMISSION[freelancer.subscriptionPlan] ?? COMMISSION.FREE;
    const commissionAmount = parseFloat((bid.proposedPrice * commissionRate).toFixed(2));

    // Fetch rejected freelancers' contact info for notifications
    const rejectedBids = await prisma.bid.findMany({
      where: { jobId: bid.jobId, id: { not: bid.id }, status: 'PENDING' },
      include: { freelancer: { select: { name: true, email: true } } },
    });

    // Atomic transaction:
    // 1. Accept this bid
    // 2. Reject all other bids on this job
    // 3. Create the contract
    // 4. Move job to IN_PROGRESS
    // 5. Debit client wallet to escrow (hold funds)
    const [contract] = await prisma.$transaction(async (tx) => {
      await tx.bid.update({ where: { id: bid.id }, data: { status: 'ACCEPTED' } });

      await tx.bid.updateMany({
        where: { jobId: bid.jobId, id: { not: bid.id }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });

      const contract = await tx.contract.create({
        data: {
          jobId: bid.jobId,
          clientId: bid.job.clientId,
          freelancerId: bid.freelancerId,
          agreedPrice: bid.proposedPrice,
          commission: commissionAmount,
        },
        include: {
          client: { select: { id: true, name: true, avatarUrl: true } },
          freelancer: { select: { id: true, name: true, avatarUrl: true } },
          job: { select: { id: true, title: true } },
        },
      });

      await tx.job.update({ where: { id: bid.jobId }, data: { status: 'IN_PROGRESS' } });

      const clientWallet = await tx.wallet.findUnique({
        where: { userId: bid.job.clientId },
      });
      if (!clientWallet || clientWallet.balance < bid.proposedPrice) {
        throw new AppError('Insufficient wallet balance to fund escrow. Please top up.', 402);
      }

      await tx.wallet.update({
        where: { userId: bid.job.clientId },
        data: { balance: { decrement: bid.proposedPrice } },
      });

      await tx.transaction.create({
        data: {
          walletId: clientWallet.id,
          type: 'ESCROW_HOLD',
          amount: bid.proposedPrice,
          reference: contract.id,
        },
      });

      return [contract];
    });

    // ── Email notifications (fire-and-forget) ──────────────────────────────────
    // Notify the accepted freelancer
    emailService.sendBidAccepted({
      to: freelancer.email,
      freelancerName: freelancer.name,
      jobTitle: bid.job.title,
      agreedPrice: bid.proposedPrice,
    }).catch(() => {});

    // Notify all rejected freelancers
    for (const rejected of rejectedBids) {
      emailService.sendBidRejected({
        to: rejected.freelancer.email,
        freelancerName: rejected.freelancer.name,
        jobTitle: bid.job.title,
      }).catch(() => {});
    }

    res.status(201).json({
      status: 'success',
      message: 'Bid accepted. Contract created and funds held in escrow.',
      data: { contract },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/bids/my — Freelancer views their own bids ───────────────────────
export const getMyBids = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { freelancerId: req.user.id };
    if (status) where.status = status;

    const [bids, total] = await Promise.all([
      prisma.bid.findMany({
        where,
        include: {
          job: {
            select: {
              id: true, title: true, category: true, budgetAmount: true,
              budgetType: true, status: true, deadline: true,
              client: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.bid.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      data: { bids, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
};
