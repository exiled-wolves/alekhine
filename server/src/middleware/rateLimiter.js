// server/src/middleware/rateLimiter.js
// Alekhine — Rate limiting via express-rate-limit

import rateLimit from 'express-rate-limit';

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

// General API — 100 req / 15 min
export const apiLimiter = make(
  15 * 60 * 1000,
  100,
  'Too many requests. Please try again later.'
);

// Auth routes — 10 attempts / 15 min (brute-force protection)
export const authLimiter = make(
  15 * 60 * 1000,
  10,
  'Too many login attempts. Please try again in 15 minutes.'
);

// Wallet / payment actions — 20 req / hour
export const walletLimiter = make(
  60 * 60 * 1000,
  20,
  'Too many wallet requests. Please slow down.'
);