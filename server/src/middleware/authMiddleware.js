// server/src/middleware/authMiddleware.js
// Alekhine — JWT verification middleware
// JWT is stored in httpOnly cookie named 'token' (never localStorage)

import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';

/**
 * protect — verifies the JWT from the httpOnly cookie.
 * Attaches the full user object (minus passwordHash) to req.user.
 * Use this on any route that requires authentication.
 */
export const protect = async (req, res, next) => {
  try {
    // 1. Extract token from httpOnly cookie
    const token = req.cookies?.token;

    if (!token) {
      throw new AppError('Not authenticated. Please log in.', 401);
    }

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Your session has expired. Please log in again.', 401);
      }
      throw new AppError('Invalid token. Please log in again.', 401);
    }

    // 3. Confirm user still exists in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionPlan: true,
        isVerified: true,
        avatarUrl: true,
        wallet: {
          select: { id: true, balance: true },
        },
      },
    });

    if (!user) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }

    // 4. Attach user to request — role comes from DB, not the token payload
    req.user = user;

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * optionalAuth — same as protect but does NOT throw if no token is present.
 * Useful for public routes that behave differently when a user is logged in
 * (e.g. showing a "bid now" button only to authenticated freelancers).
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      req.user = null;
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionPlan: true,
        isVerified: true,
        avatarUrl: true,
        wallet: {
          select: { id: true, balance: true },
        },
      },
    });

    req.user = user ?? null;
    next();
  } catch (err) {
    // Never block a request in optionalAuth — swallow errors gracefully
    req.user = null;
    next();
  }
};