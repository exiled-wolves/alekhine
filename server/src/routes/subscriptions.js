import { Router } from 'express';
import {
  getMySubscription,
  upgradeToPremium,
  cancelSubscription,
  handleStripeWebhook,
} from '../controllers/subscriptionsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// Stripe webhook — must use raw body (express.raw) before express.json parses it
// We register the raw body parser inline for this one route only.
router.post(
  '/webhook',
  (req, res, next) => {
    // If Content-Type is application/json, Stripe sends raw body
    // express.raw captures it for signature verification
    if (req.headers['stripe-signature']) {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        req.body = data;
        next();
      });
    } else {
      next();
    }
  },
  handleStripeWebhook
);

router.get('/me', protect, getMySubscription);
router.post('/upgrade', protect, upgradeToPremium);
router.post('/cancel', protect, cancelSubscription);

export default router;