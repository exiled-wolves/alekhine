import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/users.js';
import jobRoutes from './src/routes/jobs.js';
import bidRoutes from './src/routes/bids.js';
import contractRoutes from './src/routes/contracts.js';
import walletRoutes from './src/routes/wallet.js';
import reviewRoutes from './src/routes/reviews.js';
import subscriptionRoutes from './src/routes/subscriptions.js';
import adminRoutes from './src/routes/admin.js';

import { errorHandler } from './src/middleware/errorHandler.js';
import { apiLimiter, authLimiter, walletLimiter } from './src/middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// ─── GENERAL MIDDLEWARE ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/wallet', walletLimiter, walletRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', env: process.env.NODE_ENV });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FreelanceHub server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

export default app;