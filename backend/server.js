// backend/server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import connectDB from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';

import userRouter from './routes/userRoute.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import orderRouter from './routes/orderRoute.js';
import aiRouter from './routes/aiRoute.js';
import reviewRouter from './routes/reviewRoute.js';

import path from 'path';

// --- App config ---
const app = express();                     // ✅ KHÔNG khai báo const path = express()
const port = process.env.PORT || 4000;

connectDB();
connectCloudinary();

// --- Middlewares ---
app.use(cors());
// json/urlencoded dùng cho payload bình thường (multer sẽ xử lý multipart/form-data)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Cho FE truy cập file upload (ảnh/video refund)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --- API routes ---
app.use('/api/user', userRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);
app.use('/api/ai', aiRouter);
app.use('/api/review', reviewRouter);

// --- Health check ---
app.get('/', (req, res) => {
  res.send('API Working');
});

// --- Start server ---
app.listen(port, () => console.log('Server started on PORT : ' + port));
