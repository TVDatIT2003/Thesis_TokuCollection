import mongoose from 'mongoose'

const RefundRequestSchema = new mongoose.Schema({
    status: { type: String, default: 'requested' },
    reason: String,
    otherReason: String,
    images: [String],
    video: String,
    createdAt: { type: Date, default: Date.now },
});

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    items: { type: Array, required: true },
    amount: { type: Number, required: true },
    address: { type: Object, required: true },
    status: { type: String, required: true, default: 'Order Placed' },
    paymentMethod: { type: String, required: true },
    payment: { type: Boolean, required: true, default: false },
    date: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    numberOfItems: { type: Number, required: true },
    cancelReason: { type: String, default: null },
    cancalAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    status: { type: String, default: 'Order Placed' },
    userConfirmed: { type: Boolean, default: false },
    receivedAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
    cancelAt: { type: Date, default: null },
    refundRequested: { type: Boolean, default: false },
    refundReason: { type: String, default: null },
    refundStatus: { type: String, default: 'Pending' }, // Pending | Approved | Rejected | Refunded
    refundAt: { type: Date, default: null },
    refundRequest: { type: RefundRequestSchema, default: null },
    
}, { timestamps: true })


const orderModel = mongoose.models.order || mongoose.model('order', orderSchema)
export default orderModel;