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
// Raw body is captured here for signature verification.
router.post(
  '/topup/webhook',
  (req, res, next) => {
    if (req.headers['stripe-signature']) {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => { req.body = data; next(); });
    } else {
      next();
    }
  },
  confirmTopUp,
);
router.post('/withdraw', protect, allowRoles('FREELANCER', 'ADMIN'), withdraw);

// Stripe Connect onboarding — freelancers must complete this before withdrawals work
router.post('/connect/onboard', protect, allowRoles('FREELANCER'), getStripeConnectLink);

export default router;