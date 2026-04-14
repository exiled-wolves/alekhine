// server/src/services/stripeService.js
// Alekhine — Stripe integration: top-up sessions, subscription checkout, payouts

import Stripe from 'stripe';
import { AppError } from '../middleware/errorHandler.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export const stripeService = {
  // ── Top-up checkout session ─────────────────────────────────────────────────
  createTopUpSession: async ({ userId, email, amount }) => {
    const amountInCents = Math.round(amount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'FreelanceHub Wallet Top-Up',
              description: `Add $${amount.toFixed(2)} to your FreelanceHub wallet`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: { userId, amount: String(amount) },
      success_url: `${process.env.CLIENT_URL}/wallet?topup=success`,
      cancel_url: `${process.env.CLIENT_URL}/wallet?topup=cancelled`,
    });

    return session;
  },

  // ── Premium subscription checkout session ────────────────────────────────────
  createSubscriptionSession: async (email, userId) => {
    if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
      throw new AppError('Stripe premium price ID is not configured.', 500);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        { price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 },
      ],
      metadata: { userId },
      success_url: `${process.env.CLIENT_URL}/settings?subscription=success`,
      cancel_url: `${process.env.CLIENT_URL}/settings?subscription=cancelled`,
    });

    return session;
  },

  // ── Cancel a Stripe subscription ─────────────────────────────────────────────
  cancelSubscription: async (stripeSubscriptionId) => {
    return stripe.subscriptions.cancel(stripeSubscriptionId);
  },

  // ── Freelancer payout via Stripe Connect ─────────────────────────────────────
  // Requires the freelancer to have completed Connect onboarding.
  // stripeAccountId is stored on the User record after onboarding.
  createPayout: async ({ stripeAccountId, amount }) => {
    if (!stripeAccountId) {
      throw new AppError(
        'No connected payout account found. Please complete Stripe Connect onboarding in your profile settings.',
        400
      );
    }

    const amountInCents = Math.round(amount * 100);

    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: 'usd',
      destination: stripeAccountId,
    });

    return transfer;
  },

  // ── Create a Stripe Connect onboarding link ───────────────────────────────────
  // Pass existingAccountId if the user already has a Stripe account (stored in DB).
  createConnectAccountLink: async (userId, email, existingAccountId = null) => {
    let account;

    if (existingAccountId) {
      account = await stripe.accounts.retrieve(existingAccountId);
    } else {
      account = await stripe.accounts.create({
        type: 'express',
        email,
        metadata: { userId },
        capabilities: {
          transfers: { requested: true },
        },
      });
    }

    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.CLIENT_URL}/settings?stripe=refresh`,
      return_url: `${process.env.CLIENT_URL}/settings?stripe=success`,
      type: 'account_onboarding',
    });

    return { url: link.url, accountId: account.id };
  },

  // ── Construct and verify a Stripe webhook event ───────────────────────────────
  constructWebhookEvent: (rawBody, signature) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
    }
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  },
};