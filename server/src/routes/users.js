// server/src/routes/users.js

import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import {
  getUserProfile,
  updateMyProfile,
  uploadAvatar,
  listFreelancers,
  addPortfolioItem,
  removePortfolioItem,
} from '../controllers/usersController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// ── Cloudinary multer storage ─────────────────────────────────────────────────
// Uses multer-storage-cloudinary so req.file.path is the Cloudinary URL
// and req.file.filename is the public_id — no temp disk files needed.

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: (req) => ({
    folder: 'freelancehub/avatars',
    public_id: `avatar_${req.user.id}`,
    overwrite: true,
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  }),
});

const portfolioStorage = new CloudinaryStorage({
  cloudinary,
  params: (req) => ({
    folder: `freelancehub/portfolio/${req.user.id}`,
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  }),
});

const uploadAvatar_ = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadPortfolio = multer({ storage: portfolioStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Public routes ─────────────────────────────────────────────────────────────
router.get('/', listFreelancers);

// ── Authenticated /me routes — MUST come before /:id to prevent "me" being
//    treated as a user ID by Express's pattern matching ──────────────────────
router.put('/me', protect, updateMyProfile);
router.post('/me/avatar', protect, uploadAvatar_.single('avatar'), uploadAvatar);
router.post('/me/portfolio', protect, uploadPortfolio.single('image'), addPortfolioItem);
router.delete('/me/portfolio/:itemId', protect, removePortfolioItem);

// ── Dynamic param route — always last ─────────────────────────────────────────
router.get('/:id', getUserProfile);

export default router;