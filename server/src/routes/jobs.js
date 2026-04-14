// server/src/routes/jobs.js

import { Router } from 'express';
import {
  listJobs,
  createJob,
  getJob,
  updateJob,
  deleteJob,
  getMyJobs,
} from '../controllers/jobsController.js';
import { submitBid, getJobBids } from '../controllers/bidsController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();

// Public / optional auth
router.get('/', optionalAuth, listJobs);
router.get('/my', protect, allowRoles('CLIENT', 'ADMIN'), getMyJobs);
router.get('/:id', optionalAuth, getJob);

// Client-only
router.post('/', protect, allowRoles('CLIENT', 'ADMIN'), createJob);
router.put('/:id', protect, allowRoles('CLIENT', 'ADMIN'), updateJob);
router.delete('/:id', protect, allowRoles('CLIENT', 'ADMIN'), deleteJob);

// Bids nested under jobs
router.post('/:id/bids', protect, allowRoles('FREELANCER', 'ADMIN'), submitBid);
router.get('/:id/bids', protect, getJobBids);

export default router;