// server/src/utils/validators.js
// Alekhine — Input validation helpers (no external lib, pure JS)

export class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors; // array of { field, message }
  }
}

const err = (field, message) => ({ field, message });

// Run collected errors — throw if any exist
const check = (errors) => {
  if (errors.length) throw new ValidationError(errors);
};

// ── Auth ────────────────────────────────────────────────────────────────────

export const validateRegister = ({ name, email, password, role }) => {
  const errors = [];
  if (!name?.trim()) errors.push(err('name', 'Name is required.'));
  if (!email?.trim()) errors.push(err('email', 'Email is required.'));
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push(err('email', 'Invalid email address.'));
  if (!password) errors.push(err('password', 'Password is required.'));
  else if (password.length < 8)
    errors.push(err('password', 'Password must be at least 8 characters.'));
  if (!['CLIENT', 'FREELANCER'].includes(role))
    errors.push(err('role', 'Role must be CLIENT or FREELANCER.'));
  check(errors);
};

export const validateLogin = ({ email, password }) => {
  const errors = [];
  if (!email?.trim()) errors.push(err('email', 'Email is required.'));
  if (!password) errors.push(err('password', 'Password is required.'));
  check(errors);
};

// ── Jobs ────────────────────────────────────────────────────────────────────

export const validateJob = ({ title, description, category, budgetType, budgetAmount }) => {
  const errors = [];
  if (!title?.trim()) errors.push(err('title', 'Job title is required.'));
  if (!description?.trim()) errors.push(err('description', 'Description is required.'));
  if (!category?.trim()) errors.push(err('category', 'Category is required.'));
  if (!['FIXED', 'HOURLY'].includes(budgetType))
    errors.push(err('budgetType', 'Budget type must be FIXED or HOURLY.'));
  if (!budgetAmount || isNaN(budgetAmount) || budgetAmount <= 0)
    errors.push(err('budgetAmount', 'Budget must be a positive number.'));
  check(errors);
};

// ── Bids ────────────────────────────────────────────────────────────────────

export const validateBid = ({ proposedPrice, coverLetter, estimatedDays }) => {
  const errors = [];
  if (!proposedPrice || isNaN(proposedPrice) || proposedPrice <= 0)
    errors.push(err('proposedPrice', 'Proposed price must be a positive number.'));
  if (!coverLetter?.trim()) errors.push(err('coverLetter', 'Cover letter is required.'));
  if (!estimatedDays || !Number.isInteger(Number(estimatedDays)) || estimatedDays < 1)
    errors.push(err('estimatedDays', 'Estimated days must be a positive integer.'));
  check(errors);
};

// ── Reviews ─────────────────────────────────────────────────────────────────

export const validateReview = ({ rating, comment }) => {
  const errors = [];
  const r = Number(rating);
  if (!rating || isNaN(r) || r < 1 || r > 5)
    errors.push(err('rating', 'Rating must be a number between 1 and 5.'));
  if (comment && comment.length > 1000)
    errors.push(err('comment', 'Comment must be under 1000 characters.'));
  check(errors);
};

// ── Profile update ───────────────────────────────────────────────────────────

export const validateProfileUpdate = ({ email, hourlyRate }) => {
  const errors = [];
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push(err('email', 'Invalid email address.'));
  if (hourlyRate !== undefined && (isNaN(hourlyRate) || hourlyRate < 0))
    errors.push(err('hourlyRate', 'Hourly rate must be a non-negative number.'));
  check(errors);
};