// server/src/controllers/adminController.js
// Alekhine — Admin panel: user management, job oversight, dispute resolution, stats

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

// ── GET /api/admin/stats — Platform overview stats ────────────────────────────
export const getStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalClients,
      totalFrerelancers,
      totalJobs,
      openJobs,
      totalContracts,
      activeContracts,
      completedContracts,
      disputedContracts,
      totalReviews,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.user.count({ where: { role: 'FREELANCER' } }),
      prisma.job.count(),
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.contract.count(),
      prisma.contract.count({ where: { status: 'ACTIVE' } }),
      prisma.contract.count({ where: { status: 'COMPLETED' } }),
      prisma.contract.count({ where: { status: 'DISPUTED' } }),
      prisma.review.count(),
    ]);

    // Total platform revenue (sum of commissions on completed contracts)
    const revenueAgg = await prisma.contract.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { commission: true },
    });

    res.status(200).json({
      status: 'success',
      data: {
        users: { total: totalUsers, clients: totalClients, freelancers: totalFrerelancers },
        jobs: { total: totalJobs, open: openJobs },
        contracts: {
          total: totalContracts,
          active: activeContracts,
          completed: completedContracts,
          disputed: disputedContracts,
        },
        reviews: { total: totalReviews },
        revenue: { totalCommission: revenueAgg._sum.commission ?? 0 },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users — List all users with filters ───────────────────────
export const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, role, search, plan } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (plan) where.subscriptionPlan = plan;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, role: true,
          subscriptionPlan: true, isVerified: true, createdAt: true,
          avatarUrl: true,
          _count: {
            select: {
              jobsPosted: true,
              bids: true,
              contractsAsClient: true,
              contractsAsFreelancer: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      data: { users, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/users/:id/verify — Toggle verified badge ────────────────
export const toggleVerified = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError('User not found.', 404);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isVerified: !user.isVerified },
      select: { id: true, name: true, email: true, isVerified: true },
    });

    res.status(200).json({
      status: 'success',
      message: `User ${updated.isVerified ? 'verified' : 'unverified'} successfully.`,
      data: { user: updated },
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/users/:id — Remove a user account ─────────────────────
export const deleteUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError('User not found.', 404);
    if (user.role === 'ADMIN') throw new AppError('Cannot delete an admin account.', 403);

    // Check for active contracts before deleting
    const activeContracts = await prisma.contract.count({
      where: {
        OR: [{ clientId: req.params.id }, { freelancerId: req.params.id }],
        status: 'ACTIVE',
      },
    });
    if (activeContracts > 0) {
      throw new AppError(
        'Cannot delete a user with active contracts. Resolve all contracts first.',
        400
      );
    }

    await prisma.user.delete({ where: { id: req.params.id } });

    res.status(200).json({ status: 'success', message: 'User account deleted.' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/jobs — List all jobs ───────────────────────────────────────
export const listAllJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, email: true } },
          _count: { select: { bids: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.job.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      data: { jobs, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/contracts — List all contracts, focus on disputed ──────────
export const listAllContracts = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          job: { select: { id: true, title: true } },
          client: { select: { id: true, name: true, email: true } },
          freelancer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.contract.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      data: { contracts, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/admin/contracts/:id/resolve — Resolve a disputed contract ──────
// Admin decides: release funds to freelancer OR refund client
export const resolveDispute = async (req, res, next) => {
  try {
    const { resolution } = req.body; // 'release' | 'refund'

    if (!['release', 'refund'].includes(resolution)) {
      throw new AppError("resolution must be 'release' (pay freelancer) or 'refund' (pay client).", 400);
    }

    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        freelancer: { select: { id: true, subscriptionPlan: true } },
      },
    });

    if (!contract) throw new AppError('Contract not found.', 404);
    if (contract.status !== 'DISPUTED') {
      throw new AppError('Only disputed contracts can be resolved.', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (resolution === 'release') {
        // Release escrow to freelancer (minus commission)
        const commissionRate =
          contract.freelancer.subscriptionPlan === 'PREMIUM' ? 0.05 : 0.10;
        const commissionAmount = parseFloat((contract.agreedPrice * commissionRate).toFixed(2));
        const payout = parseFloat((contract.agreedPrice - commissionAmount).toFixed(2));

        const freelancerWallet = await tx.wallet.findUnique({
          where: { userId: contract.freelancerId },
        });

        await tx.wallet.update({
          where: { userId: contract.freelancerId },
          data: { balance: { increment: payout } },
        });

        await tx.transaction.create({
          data: {
            walletId: freelancerWallet.id,
            type: 'ESCROW_RELEASE',
            amount: payout,
            reference: contract.id,
          },
        });
      } else {
        // Refund escrow to client
        const clientWallet = await tx.wallet.findUnique({
          where: { userId: contract.clientId },
        });

        await tx.wallet.update({
          where: { userId: contract.clientId },
          data: { balance: { increment: contract.agreedPrice } },
        });

        await tx.transaction.create({
          data: {
            walletId: clientWallet.id,
            type: 'CREDIT',
            amount: contract.agreedPrice,
            reference: contract.id,
          },
        });
      }

      // Mark job cancelled if refund, completed if release
      await tx.job.update({
        where: { id: contract.jobId },
        data: { status: resolution === 'release' ? 'COMPLETED' : 'CANCELLED' },
      });

      return tx.contract.update({
        where: { id: contract.id },
        data: {
          status: resolution === 'release' ? 'COMPLETED' : 'CANCELLED',
          completedAt: new Date(),
        },
        include: {
          client: { select: { id: true, name: true } },
          freelancer: { select: { id: true, name: true } },
        },
      });
    });

    res.status(200).json({
      status: 'success',
      message: `Dispute resolved: funds ${resolution === 'release' ? 'released to freelancer' : 'refunded to client'}.`,
      data: { contract: updated },
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/reviews/:id — Remove an abusive review ─────────────────
export const deleteReview = async (req, res, next) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) throw new AppError('Review not found.', 404);

    await prisma.review.delete({ where: { id: req.params.id } });

    res.status(200).json({ status: 'success', message: 'Review removed.' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/transactions — Platform-wide transaction log ───────────────
export const listTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          wallet: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      data: { transactions, total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
};