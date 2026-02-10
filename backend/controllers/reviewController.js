import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import reviewModel from '../models/reviewModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- Upload config (uploads/reviews) ---------- */
const REVIEW_DIR = path.join(__dirname, '..', 'uploads', 'reviews');
fs.mkdirSync(REVIEW_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REVIEW_DIR),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, safe + path.extname(file.originalname || ''));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
  else cb(new Error('Unsupported file type'), false);
};

export const uploadReviewMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB/file
}).fields([
  { name: 'images', maxCount: 4 },
  { name: 'video',  maxCount: 1 },
]);

/* -------------- Create review -------------- */
export const createReview = async (req, res) => {
  try {
    const { productId, orderId, rating, comment } = req.body;

    if (!productId) return res.status(400).json({ success: false, message: 'Missing productId' });
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ success: false, message: 'Rating 1..5 required' });
    }

    // Lấy userId từ middleware hoặc token header
    let userId = req.userId;
    if (!userId) {
      const bearer = req.headers?.authorization?.split(' ')[1];
      const token = req.headers?.token || bearer;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded?.id || decoded?._id || decoded?.userId;
        } catch {}
      }
    }
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const images = (req.files?.images || []).map((f) =>
      ('/uploads/reviews/' + path.basename(f.path)).replace(/\\/g, '/')
    );
    const video = req.files?.video?.[0]
      ? ('/uploads/reviews/' + path.basename(req.files.video[0].path)).replace(/\\/g, '/')
      : null;

    const rv = await reviewModel.create({
      productId,
      orderId: orderId || undefined,
      userId,
      rating: r,
      comment: comment || '',
      images,
      video,
    });

    return res.json({ success: true, review: rv });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};
