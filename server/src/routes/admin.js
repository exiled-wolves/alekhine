// server/src/routes/admin.js
// All routes require ADMIN role

import { Router } from 'express';
import {
  getStats,
  listUsers,
  toggleVerified,
  deleteUser,
  listAllJobs,
  listAllContracts,
  resolveDispute,
  deleteReview,
  listTransactions,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();

// All admin routes are protected + ADMIN-only
router.use(protect, allowRoles('ADMIN'));

router.get('/stats', getStats);

router.get('/users', listUsers);
router.patch('/users/:id/verify', toggleVerified);
router.delete('/users/:id', deleteUser);

router.get('/jobs', listAllJobs);

router.get('/contracts', listAllContracts);
router.post('/contracts/:id/resolve', resolveDispute);

router.delete('/reviews/:id', deleteReview);

router.get('/transactions', listTransactions);

export default router;