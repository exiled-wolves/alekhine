// server/src/routes/bids.js

import { Router } from 'express';
import { acceptBid, getMyBids } from '../controllers/bidsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();

router.get('/my', protect, allowRoles('FREELANCER', 'ADMIN'), getMyBids);
router.post('/:id/accept', protect, allowRoles('CLIENT', 'ADMIN'), acceptBid);

export default router;