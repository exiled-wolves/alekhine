import { Router } from 'express';
import {
  getMySubscription,
  upgradeToPremium,
  cancelSubscription,
  handleStripeWebhook,
} from '../controllers/subscriptionsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// Stripe webhook — express.raw() is applied to this path in index.js.
// req.body is a Buffer here — do NOT add express.json() before this route.
router.post('/webhook', handleStripeWebhook);

router.get('/me', protect, getMySubscription);
router.post('/upgrade', protect, upgradeToPremium);
router.post('/cancel', protect, cancelSubscription);

export default router;