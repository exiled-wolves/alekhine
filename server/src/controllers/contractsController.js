// server/src/controllers/contractsController.js
// Alekhine — Contract lifecycle: view, complete, dispute

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { COMMISSION } from '../utils/constants.js';

// ── GET /api/contracts/my — Get current user's contracts ─────────────────────
export const getMyContracts = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const isClient = req.user.role === 'CLIENT';
    const idField = isClient ? 'clientId' : 'freelancerId';

    const where = { [idField]: req.user.id };
    if (status) where.status = status;

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          job: { select: { id: true, title: true, category: true } },
          client: { select: { id: true, name: true, avatarUrl: true } },
          freelancer: { select: { id: true, name: true, avatarUrl: true } },
          review: true,
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

// ── GET /api/contracts/:id — Get single contract detail ──────────────────────
export const getContract = async (req, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        job: true,
        client: { select: { id: true, name: true, avatarUrl: true, email: true } },
        freelancer: { select: { id: true, name: true, avatarUrl: true, email: true } },
        review: {
          include: {
            client: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!contract) throw new AppError('Contract not found.', 404);

    // Only involved parties or admin can view
    const isParty =
      contract.clientId === req.user.id || contract.freelancerId === req.user.id;
    if (!isParty && req.user.role !== 'ADMIN') {
      throw new AppError('You are not authorized to view this contract.', 403);
    }

    res.status(200).json({ status: 'success', data: { contract } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/contracts/:id/complete — Client marks contract as complete ──────
// This releases escrow: platform takes commission, remainder goes to freelancer
export const completeContract = async (req, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: { freelancer: { select: { id: true, subscriptionPlan: true } } },
    });

    if (!contract) throw new AppError('Contract not found.', 404);
    if (contract.clientId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('Only the client on this contract can mark it complete.', 403);
    }
    if (contract.status !== 'ACTIVE') {
      throw new AppError(`Cannot complete a contract with status: ${contract.status}.`, 400);
    }

    // Recalculate commission based on current plan (plan might have changed)
    const commissionRate = COMMISSION[contract.freelancer.subscriptionPlan] ?? COMMISSION.FREE;
    const commissionAmount = parseFloat((contract.agreedPrice * commissionRate).toFixed(2));
    const freelancerPayout = parseFloat((contract.agreedPrice - commissionAmount).toFixed(2));

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Mark contract complete
      const updated = await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          commission: commissionAmount,
        },
        include: {
          job: { select: { id: true, title: true } },
          client: { select: { id: true, name: true, avatarUrl: true } },
          freelancer: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // 2. Mark job as completed
      await tx.job.update({
        where: { id: contract.jobId },
        data: { status: 'COMPLETED' },
      });

      // 3. Credit freelancer wallet (escrow release minus commission)
      const freelancerWallet = await tx.wallet.upsert({
        where: { userId: contract.freelancerId },
        update: { balance: { increment: freelancerPayout } },
        create: { userId: contract.freelancerId, balance: freelancerPayout },
      });

      await tx.transaction.create({
        data: {
          walletId: freelancerWallet.id,
          type: 'ESCROW_RELEASE',
          amount: freelancerPayout,
          reference: contract.id,
        },
      });

      return updated;
    });

    res.status(200).json({
      status: 'success',
      message: `Contract completed. $${freelancerPayout} released to freelancer (commission: $${commissionAmount}).`,
      data: { contract: updated },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/contracts/:id/dispute — Either party raises a dispute ───────────
export const disputeContract = async (req, res, next) => {
  try {
    const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });
    if (!contract) throw new AppError('Contract not found.', 404);

    const isParty =
      contract.clientId === req.user.id || contract.freelancerId === req.user.id;
    if (!isParty && req.user.role !== 'ADMIN') {
      throw new AppError('Only parties involved in this contract can raise a dispute.', 403);
    }
    if (contract.status !== 'ACTIVE') {
      throw new AppError(`Cannot dispute a contract with status: ${contract.status}.`, 400);
    }

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'DISPUTED' },
      include: {
        job: { select: { id: true, title: true } },
        client: { select: { id: true, name: true } },
        freelancer: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Dispute raised. An admin will review this contract.',
      data: { contract: updated },
    });
  } catch (err) {
    next(err);
  }
};