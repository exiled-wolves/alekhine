// server/src/routes/users.js

import { Router } from 'express';
import multer from 'multer';
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

// Multer — memory storage, Cloudinary handles persistence
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public
router.get('/', listFreelancers);
router.get('/:id', getUserProfile);

// Authenticated
router.put('/me', protect, updateMyProfile);
router.post('/me/avatar', protect, upload.single('avatar'), uploadAvatar);
router.post('/me/portfolio', protect, upload.single('image'), addPortfolioItem);
router.delete('/me/portfolio/:itemId', protect, removePortfolioItem);

export default router;