// server/src/controllers/jobsController.js
// Alekhine — Job posting, browsing, management (CLIENT-only writes)

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateJob } from '../utils/validators.js';

// ── GET /api/jobs — Browse all open jobs (public, with filters) ───────────────
export const listJobs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      budgetType,
      minBudget,
      maxBudget,
      skill,
      search,
      status = 'OPEN',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (budgetType) where.budgetType = budgetType;
    if (minBudget || maxBudget) {
      where.budgetAmount = {};
      if (minBudget) where.budgetAmount.gte = parseFloat(minBudget);
      if (maxBudget) where.budgetAmount.lte = parseFloat(maxBudget);
    }
    if (skill) where.skills = { has: skill };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, avatarUrl: true, isVerified: true },
          },
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
      data: {
        jobs,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/jobs — Create a job (CLIENT only) ───────────────────────────────
export const createJob = async (req, res, next) => {
  try {
    const { title, description, category, skills, budgetType, budgetAmount, deadline } = req.body;

    validateJob({ title, description, category, budgetType, budgetAmount });

    const job = await prisma.job.create({
      data: {
        clientId: req.user.id,
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        skills: Array.isArray(skills) ? skills : [],
        budgetType,
        budgetAmount: parseFloat(budgetAmount),
        deadline: deadline ? new Date(deadline) : null,
      },
      include: {
        client: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ status: 'success', data: { job } });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/jobs/:id — Get single job detail (public) ───────────────────────
export const getJob = async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: { id: true, name: true, avatarUrl: true, isVerified: true, createdAt: true },
        },
        _count: { select: { bids: true } },
      },
    });

    if (!job) throw new AppError('Job not found.', 404);

    // If authenticated user is the client, include their bids on this job
    let userBid = null;
    if (req.user?.role === 'FREELANCER') {
      userBid = await prisma.bid.findUnique({
        where: { jobId_freelancerId: { jobId: job.id, freelancerId: req.user.id } },
      });
    }

    res.status(200).json({ status: 'success', data: { job, userBid } });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/jobs/:id — Update a job (CLIENT, owner only) ────────────────────
export const updateJob = async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw new AppError('Job not found.', 404);
    if (job.clientId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('You are not authorized to edit this job.', 403);
    }
    if (job.status !== 'OPEN') {
      throw new AppError('Only open jobs can be edited.', 400);
    }

    const { title, description, category, skills, budgetType, budgetAmount, deadline, status } = req.body;

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (category) updateData.category = category.trim();
    if (skills) updateData.skills = Array.isArray(skills) ? skills : [];
    if (budgetType) updateData.budgetType = budgetType;
    if (budgetAmount) updateData.budgetAmount = parseFloat(budgetAmount);
    if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null;
    if (status && ['OPEN', 'CANCELLED'].includes(status)) updateData.status = status;

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: updateData,
      include: { client: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.status(200).json({ status: 'success', data: { job: updated } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/jobs/:id — Delete a job (CLIENT, owner only, OPEN only) ───────
export const deleteJob = async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) throw new AppError('Job not found.', 404);
    if (job.clientId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('You are not authorized to delete this job.', 403);
    }
    if (job.status === 'IN_PROGRESS') {
      throw new AppError('Cannot delete a job that is in progress. Cancel the contract first.', 400);
    }

    await prisma.job.delete({ where: { id: job.id } });

    res.status(200).json({ status: 'success', message: 'Job deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/jobs/my — Get current client's jobs ─────────────────────────────
export const getMyJobs = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { clientId: req.user.id };
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { _count: { select: { bids: true } } },
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