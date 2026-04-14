// server/src/services/cloudinaryService.js
// Alekhine — Cloudinary file upload helpers

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudinaryService = {
  // ── Upload user avatar ────────────────────────────────────────────────────────
  uploadAvatar: async (filePath, userId) => {
    return cloudinary.uploader.upload(filePath, {
      folder: 'freelancehub/avatars',
      public_id: `avatar_${userId}`,
      overwrite: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });
  },

  // ── Upload portfolio image ────────────────────────────────────────────────────
  uploadPortfolioImage: async (filePath, userId) => {
    return cloudinary.uploader.upload(filePath, {
      folder: `freelancehub/portfolio/${userId}`,
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });
  },

  // ── Delete an asset by public_id ──────────────────────────────────────────────
  deleteAsset: async (publicId) => {
    return cloudinary.uploader.destroy(publicId);
  },
};