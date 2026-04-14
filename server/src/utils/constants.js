// server/src/utils/constants.js
// Alekhine — Shared constants and enums

// Commission rates (also in .env — these are fallback defaults)
export const COMMISSION = {
  FREE: parseFloat(process.env.COMMISSION_FREE) || 0.10,
  PREMIUM: parseFloat(process.env.COMMISSION_PREMIUM) || 0.05,
};

// User roles
export const ROLES = {
  CLIENT: 'CLIENT',
  FREELANCER: 'FREELANCER',
  ADMIN: 'ADMIN',
};

// Job statuses
export const JOB_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// Bid statuses
export const BID_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
};

// Contract statuses
export const CONTRACT_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED',
};

// Transaction types
export const TRANSACTION_TYPE = {
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  ESCROW_HOLD: 'ESCROW_HOLD',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
  WITHDRAWAL: 'WITHDRAWAL',
};

// Subscription plans
export const PLANS = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
};

// Budget types
export const BUDGET_TYPE = {
  FIXED: 'FIXED',
  HOURLY: 'HOURLY',
};

// JWT cookie config
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};