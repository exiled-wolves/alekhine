// server/src/controllers/usersController.js
// Alekhine — User profile management & freelancer directory

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateProfileUpdate } from '../utils/validators.js';

// ── GET /api/users/:id — Public freelancer/user profile ──────────────────────
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        bio: true,
        skills: true,
        hourlyRate: true,
        location: true,
        availability: true,
        avatarUrl: true,
        role: true,
        subscriptionPlan: true,
        isVerified: true,
        createdAt: true,
        portfolioItems: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            contractsAsFreelancer: { where: { status: 'COMPLETED' } },
            reviewsReceived: true,
          },
        },
      },
    });

    if (!user) throw new AppError('User not found.', 404);

    // Compute average rating
    const ratingAgg = await prisma.review.aggregate({
      where: { freelancerId: req.params.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          avgRating: ratingAgg._avg.rating
            ? parseFloat(ratingAgg._avg.rating.toFixed(2))
            : null,
          totalReviews: ratingAgg._count.rating,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/users/me — Update own profile ────────────────────────────────────
export const updateMyProfile = async (req, res, next) => {
  try {
    const { name, bio, skills, hourlyRate, location, availability, email } = req.body;

    validateProfileUpdate({ email, hourlyRate });

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (skills !== undefined) updateData.skills = Array.isArray(skills) ? skills : [];
    if (hourlyRate !== undefined) updateData.hourlyRate = parseFloat(hourlyRate);
    if (location !== undefined) updateData.location = location.trim();
    if (availability !== undefined) updateData.availability = Boolean(availability);
    if (email !== undefined) {
      const conflict = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), NOT: { id: req.user.id } },
      });
      if (conflict) throw new AppError('That email is already in use.', 409);
      updateData.email = email.toLowerCase().trim();
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true, name: true, email: true, role: true, bio: true,
        skills: true, hourlyRate: true, location: true, availability: true,
        avatarUrl: true, subscriptionPlan: true, isVerified: true,
      },
    });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/users/me/avatar — Upload avatar (multer-storage-cloudinary handles upload)
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded.', 400);

    // multer-storage-cloudinary sets req.file.path = secure Cloudinary URL
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: req.file.path },
      select: { id: true, name: true, avatarUrl: true },
    });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/users — Browse freelancers (public) ──────────────────────────────
export const listFreelancers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, skill, minRate, maxRate, available, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { role: 'FREELANCER' };
    if (skill) where.skills = { has: skill };
    if (available === 'true') where.availability = true;
    if (minRate || maxRate) {
      where.hourlyRate = {};
      if (minRate) where.hourlyRate.gte = parseFloat(minRate);
      if (maxRate) where.hourlyRate.lte = parseFloat(maxRate);
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [freelancers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, bio: true, skills: true, hourlyRate: true,
          location: true, availability: true, avatarUrl: true, isVerified: true,
          subscriptionPlan: true, createdAt: true,
          _count: { select: { reviewsReceived: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        freelancers,
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

// ── POST /api/users/me/portfolio — Add portfolio item ────────────────────────
export const addPortfolioItem = async (req, res, next) => {
  try {
    const { title, description, projectUrl } = req.body;
    if (!title?.trim()) throw new AppError('Title is required.', 400);

    // multer-storage-cloudinary sets req.file.path = secure Cloudinary URL
    const imageUrl = req.file ? req.file.path : null;

    const item = await prisma.portfolioItem.create({
      data: {
        userId: req.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        projectUrl: projectUrl?.trim() || null,
        imageUrl,
      },
    });

    res.status(201).json({ status: 'success', data: { item } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/users/me/portfolio/:itemId — Remove portfolio item ────────────
export const removePortfolioItem = async (req, res, next) => {
  try {
    const item = await prisma.portfolioItem.findUnique({
      where: { id: req.params.itemId },
    });

    if (!item) throw new AppError('Portfolio item not found.', 404);
    if (item.userId !== req.user.id) throw new AppError('Not authorized.', 403);

    await prisma.portfolioItem.delete({ where: { id: item.id } });

    res.status(200).json({ status: 'success', message: 'Portfolio item removed.' });
  } catch (err) {
    next(err);
  }
};