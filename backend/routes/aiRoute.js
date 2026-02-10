// backend/routes/aiRoute.js
import express from 'express';
import { chatRAGHandler } from '../controllers/aiController.js';

const router = express.Router();

// Nếu bạn cần auth thì thêm middleware trước chatRAGHandler
router.post('/chat', chatRAGHandler);

export default router;