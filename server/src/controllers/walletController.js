// server/src/controllers/walletController.js
// Alekhine — In-app wallet: balance, top-up via Stripe, withdraw (FREELANCER only)
// Rule 2: Every user has a wallet. Earnings go here first. User controls withdrawal.

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { stripeService } from '../services/stripeService.js';

// ── GET /api/wallet/me — Wallet balance + transaction history ────────────────
export const getMyWallet = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });

    if (!wallet) throw new AppError('Wallet not found. Please contact support.', 404);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where: { walletId: wallet.id } }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        wallet: {
          id: wallet.id,
          balance: wallet.balance,
          updatedAt: wallet.updatedAt,
        },
        transactions,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/wallet/topup — Create Stripe checkout session for top-up ────────
export const topUp = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const parsed = parseFloat(amount);

    if (!amount || isNaN(parsed) || parsed < 5) {
      throw new AppError('Minimum top-up amount is $5.', 400);
    }
    if (parsed > 10000) {
      throw new AppError('Maximum single top-up is $10,000.', 400);
    }

    // Create Stripe Checkout Session
    const session = await stripeService.createTopUpSession({
      userId: req.user.id,
      email: req.user.email,
      amount: parsed,
    });

    res.status(200).json({
      status: 'success',
      data: { checkoutUrl: session.url, sessionId: session.id },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/wallet/connect/onboard — Freelancer Stripe Connect onboarding ───
// Freelancers must complete Connect onboarding before they can withdraw earnings.
export const getStripeConnectLink = async (req, res, next) => {
  try {
    const { url, accountId } = await stripeService.createConnectAccountLink(
      req.user.id,
      req.user.email
    );

    res.status(200).json({
      status: 'success',
      data: { onboardingUrl: url, accountId },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/wallet/topup/webhook — Stripe webhook confirms wallet top-up ────
// Called by Stripe — NOT by the user directly. No auth middleware used.
export const confirmTopUp = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripeService.constructWebhookEvent(req.body, sig);
    } catch (err) {
      return res.status(400).json({ message: `Webhook error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const amount = session.metadata?.amount ? parseFloat(session.metadata.amount) : 0;

      if (!userId || !amount) {
        return res.status(400).json({ message: 'Missing metadata on session.' });
      }

      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) return res.status(404).json({ message: 'Wallet not found.' });

      await prisma.$transaction([
        prisma.wallet.update({
          where: { userId },
          data: { balance: { increment: amount } },
        }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount,
            reference: session.id,
          },
        }),
      ]);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/wallet/withdraw — Freelancer requests a payout ─────────────────
export const withdraw = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const parsed = parseFloat(amount);

    if (!amount || isNaN(parsed) || parsed < 10) {
      throw new AppError('Minimum withdrawal amount is $10.', 400);
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) throw new AppError('Wallet not found.', 404);
    if (wallet.balance < parsed) {
      throw new AppError(
        `Insufficient balance. Your current balance is $${wallet.balance.toFixed(2)}.`,
        400
      );
    }

    // Initiate Stripe Connect payout (returns transfer ID)
    const transfer = await stripeService.createPayout({
      userId: req.user.id,
      email: req.user.email,
      amount: parsed,
    });

    // Debit the wallet and record the withdrawal
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: req.user.id },
        data: { balance: { decrement: parsed } },
      }),
      prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: parsed,
          reference: transfer.id,
        },
      }),
    ]);

    res.status(200).json({
      status: 'success',
      message: `Withdrawal of $${parsed.toFixed(2)} initiated. Funds will appear in your bank account within 2–5 business days.`,
      data: { transferId: transfer.id },
    });
  } catch (err) {
    next(err);
  }
};