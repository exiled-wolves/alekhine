// server/src/routes/wallet.js

import { Router } from 'express';
import {
  getMyWallet,
  topUp,
  confirmTopUp,
  withdraw,
  getStripeConnectLink,
} from '../controllers/walletController.js';
import { protect } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();

router.get('/me', protect, getMyWallet);
router.post('/topup', protect, topUp);
// Stripe webhook — must NOT use protect (Stripe calls this, not the user).
// express.raw() is applied to this path in index.js (before express.json)
// so req.body arrives as a Buffer, which stripe.webhooks.constructEvent needs.
router.post('/topup/webhook', confirmTopUp);
router.post('/withdraw', protect, allowRoles('FREELANCER', 'ADMIN'), withdraw);

// Stripe Connect onboarding — freelancers must complete this before withdrawals work
router.post('/connect/onboard', protect, allowRoles('FREELANCER'), getStripeConnectLink);

export default router;