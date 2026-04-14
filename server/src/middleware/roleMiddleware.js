// server/src/middleware/roleMiddleware.js
// Alekhine — Role-based access control
// Always used AFTER protect middleware

import { AppError } from './errorHandler.js';

/**
 * allowRoles(...roles) — restricts a route to specific roles.
 * Usage: router.post('/jobs', protect, allowRoles('CLIENT'), createJob)
 */
export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. This action is restricted to: ${roles.join(', ')}.`,
          403
        )
      );
    }

    next();
  };
};