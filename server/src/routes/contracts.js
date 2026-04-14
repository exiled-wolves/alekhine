// server/src/routes/contracts.js

import { Router } from 'express';
import {
  getMyContracts,
  getContract,
  completeContract,
  disputeContract,
} from '../controllers/contractsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();

router.get('/my', protect, getMyContracts);
router.get('/:id', protect, getContract);
router.post('/:id/complete', protect, allowRoles('CLIENT', 'ADMIN'), completeContract);
router.post('/:id/dispute', protect, disputeContract);

export default router;