import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'product' },
    orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'order' },
    userId:    { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'user' },
    rating:    { type: Number, min: 1, max: 5, required: true },
    comment:   { type: String, default: '' },
    images:    [{ type: String }],
    video:     { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('review', reviewSchema);
