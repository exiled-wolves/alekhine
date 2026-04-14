// server/src/routes/wallet.js

import { Router } from 'express';
import {
  getMyWallet,
  topUp,
  confirmTopUp,
  withdraw,
} from '../controllers/walletController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();

router.get('/me', protect, getMyWallet);
router.post('/topup', protect, topUp);
router.post('/topup/confirm', protect, confirmTopUp);
router.post('/withdraw', protect, allowRoles('FREELANCER', 'ADMIN'), withdraw);

export default router;