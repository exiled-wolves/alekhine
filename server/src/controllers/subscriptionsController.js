// server/src/controllers/subscriptionsController.js

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { stripeService } from '../services/stripeService.js';

// GET /api/subscriptions/me — Get current user's active subscription
export const getMySubscription = async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    });

    res.status(200).json({ status: 'success', data: { subscription } });
  } catch (err) {
    next(err);
  }
};

// POST /api/subscriptions/upgrade — Subscribe to PREMIUM
export const upgradeToPremium = async (req, res, next) => {
  try {
    if (req.user.subscriptionPlan === 'PREMIUM') {
      throw new AppError('You are already on the PREMIUM plan.', 400);
    }

    // Create Stripe checkout session or subscription
    const session = await stripeService.createSubscriptionSession(
      req.user.email,
      req.user.id
    );

    res.status(200).json({
      status: 'success',
      data: { checkoutUrl: session.url, sessionId: session.id },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/subscriptions/cancel — Cancel PREMIUM subscription
export const cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: 'ACTIVE', plan: 'PREMIUM' },
    });
    if (!subscription) throw new AppError('No active premium subscription found.', 404);

    // Cancel in Stripe if we have the ID
    if (subscription.stripeSubscriptionId) {
      await stripeService.cancelSubscription(subscription.stripeSubscriptionId);
    }

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED', expiresAt: new Date() },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: { subscriptionPlan: 'FREE' },
      }),
    ]);

    res.status(200).json({ status: 'success', message: 'Subscription cancelled. You are now on the FREE plan.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/subscriptions/webhook — Stripe webhook for subscription events
export const handleStripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripeService.constructWebhookEvent(req.body, sig);
    } catch (err) {
      return res.status(400).json({ message: `Webhook error: ${err.message}` });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) break;

        await prisma.$transaction([
          prisma.subscription.create({
            data: {
              userId,
              plan: 'PREMIUM',
              stripeSubscriptionId: session.subscription,
              status: 'ACTIVE',
            },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { subscriptionPlan: 'PREMIUM' },
          }),
        ]);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription },
          data: { status: 'PAST_DUE' },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const record = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (record) {
          await prisma.$transaction([
            prisma.subscription.update({
              where: { id: record.id },
              data: { status: 'CANCELLED', expiresAt: new Date() },
            }),
            prisma.user.update({
              where: { id: record.userId },
              data: { subscriptionPlan: 'FREE' },
            }),
          ]);
        }
        break;
      }

      default:
        // Unhandled event type — that's fine
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};