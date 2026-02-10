import express from 'express';
import { uploadReviewMedia, createReview } from '../controllers/reviewController.js';

const reviewRouter = express.Router();
// Có thể thêm middleware auth nếu bạn đã có sẵn
reviewRouter.post('/create', uploadReviewMedia, createReview);

export default reviewRouter;
