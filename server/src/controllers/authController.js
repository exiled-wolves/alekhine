// server/src/controllers/authController.js
// Alekhine — Authentication: register, login, logout, getMe
// Rule 1: Role is chosen ONLY at signup. Login reads role from DB — never re-asks.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateRegister, validateLogin } from '../utils/validators.js';
import { COOKIE_OPTIONS } from '../utils/constants.js';
import { emailService } from '../services/emailService.js';

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── POST /api/auth/register ───────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    validateRegister({ name, email, password, role });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new AppError('An account with that email already exists.', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user + wallet in a single transaction (Rule 2: every user gets a wallet)
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash,
          role, // CLIENT | FREELANCER — set once, never changed
        },
      });

      await tx.wallet.create({ data: { userId: newUser.id } });

      return newUser;
    });

    // Issue JWT in httpOnly cookie
    const token = signToken(user.id);
    res.cookie('token', token, COOKIE_OPTIONS);

    // Send welcome email (fire-and-forget)
    emailService.sendWelcome({ to: user.email, name: user.name }).catch(() => {});

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan,
          isVerified: user.isVerified,
          avatarUrl: user.avatarUrl,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    validateLogin({ email, password });

    // Fetch user — role always comes from DB (Rule 1)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { wallet: { select: { id: true, balance: true } } },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError('Invalid email or password.', 401);
    }

    const token = signToken(user.id);
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,               // from DB — Rule 1
          subscriptionPlan: user.subscriptionPlan,
          isVerified: user.isVerified,
          avatarUrl: user.avatarUrl,
          wallet: user.wallet,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bio: true,
        skills: true,
        hourlyRate: true,
        location: true,
        availability: true,
        avatarUrl: true,
        subscriptionPlan: true,
        isVerified: true,
        stripeAccountId: true,
        createdAt: true,
        wallet: { select: { id: true, balance: true } },
        portfolioItems: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) throw new AppError('User not found.', 404);

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};
