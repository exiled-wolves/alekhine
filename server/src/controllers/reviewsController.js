// server/src/controllers/reviewsController.js

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateReview } from '../utils/validators.js';

// POST /api/reviews — Leave a review after job completion (CLIENT only)
export const createReview = async (req, res, next) => {
  try {
    const { contractId, rating, comment } = req.body;
    if (!contractId) throw new AppError('contractId is required.', 400);
    validateReview({ rating, comment });

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { review: true },
    });
    if (!contract) throw new AppError('Contract not found.', 404);
    if (contract.clientId !== req.user.id) {
      throw new AppError('Only the client on this contract can leave a review.', 403);
    }
    if (contract.status !== 'COMPLETED') {
      throw new AppError('Reviews can only be left on completed contracts.', 400);
    }
    if (contract.review) {
      throw new AppError('A review has already been submitted for this contract.', 409);
    }

    const review = await prisma.review.create({
      data: {
        contractId,
        clientId: req.user.id,
        freelancerId: contract.freelancerId,
        rating: parseInt(rating),
        comment: comment?.trim() || null,
      },
      include: {
        client: { select: { id: true, name: true, avatarUrl: true } },
        freelancer: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ status: 'success', data: { review } });
  } catch (err) {
    next(err);
  }
};

// GET /api/reviews/:freelancerId — Get all reviews for a freelancer (public)
export const getFreelancerReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { freelancerId: req.params.freelancerId },
        include: {
          client: { select: { id: true, name: true, avatarUrl: true } },
          contract: { select: { id: true, agreedPrice: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.review.count({ where: { freelancerId: req.params.freelancerId } }),
    ]);

    const ratings = reviews.map((r) => r.rating);
    const avgRating = ratings.length
      ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
      : null;

    res.status(200).json({
      status: 'success',
      data: { reviews, total, avgRating, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    next(err);
  }
};