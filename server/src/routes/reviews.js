// server/src/routes/reviews.js

import { Router } from 'express';
import { createReview, getFreelancerReviews } from '../controllers/reviewsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();

router.post('/', protect, allowRoles('CLIENT', 'ADMIN'), createReview);
router.get('/:freelancerId', getFreelancerReviews);

export default router;