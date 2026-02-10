import express from 'express'
import {placeOrder, placeOrderStripe, allOrders, deleteOrder, userOrders, updateStatus, verifyStripe,  placeOrderPayPal, verifyPayPal, updateStatusBulk, uploadRefundMedia, requestRefundWithMedia} from '../controllers/orderController.js'
import adminAuth  from '../middleware/adminAuth.js'
import authUser from '../middleware/auth.js'
import { confirmReceived, cancelOrder, requestRefund } from '../controllers/orderController.js';


const orderRouter = express.Router()

// Admin Features
orderRouter.post('/list',adminAuth,allOrders)
orderRouter.post('/status',adminAuth,updateStatus)
orderRouter.post('/delete',adminAuth,deleteOrder)

orderRouter.post('/status-bulk', adminAuth, updateStatusBulk);

// Payment Features
orderRouter.post('/place',authUser,placeOrder)
orderRouter.post('/stripe',authUser,placeOrderStripe)
orderRouter.post('/paypal', authUser, placeOrderPayPal);

// User Feature 
orderRouter.post('/userorders',authUser,userOrders)

// verify payment
orderRouter.post('/verifyStripe',authUser, verifyStripe)
orderRouter.post('/verifyPayPal', authUser, verifyPayPal);

orderRouter.post('/confirm', authUser, confirmReceived);
orderRouter.post('/cancel', authUser, cancelOrder);
orderRouter.post('/refund', authUser, requestRefund);

orderRouter.post('/request-refund/:orderId', authUser, uploadRefundMedia, requestRefundWithMedia);

export default orderRouter