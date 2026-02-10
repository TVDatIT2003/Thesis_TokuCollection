import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Stripe from "stripe";
import paypal from "@paypal/checkout-server-sdk";
import productModel from "../models/productModel.js";
import path from "path";
import fs from "fs";
import multer from "multer";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ----------------------------- Money helpers ----------------------------- */
// Dùng cent để tránh sai số số thực
const toCents = (n) => Math.round(Number(n || 0) * 100);
// Trả string 2 chữ số thập phân cho PayPal/hiển thị
const fromCents = (c) => (Math.round(Number(c || 0)) / 100).toFixed(2);
// Tổng tiền các item (chưa gồm ship)
const itemsToCents = (items = []) =>
  items.reduce((sum, it) => {
    const qty = Math.max(1, Number(it.quantity || 1));
    return sum + toCents(it.price) * qty;
  }, 0);

/* ----------------------------- Stock helpers ----------------------------- */
async function decreaseStock(items) {
  for (const it of items) {
    const pid = it.productId || it._id || it.id;
    const qty = Number(it.quantity ?? 1);
    if (!pid || !Number.isFinite(qty) || qty <= 0) continue;
    await productModel.findByIdAndUpdate(
      pid,
      { $inc: { stock: -qty } },
      { new: true }
    );
  }
}

async function increaseStock(items) {
  for (const it of items) {
    const pid = it.productId || it._id || it.id;
    const qty = Number(it.quantity ?? 1);
    if (!pid || !Number.isFinite(qty) || qty <= 0) continue;
    await productModel.findByIdAndUpdate(
      pid,
      { $inc: { stock: qty } },
      { new: true }
    );
  }
}

/* --------------------------------- Config -------------------------------- */
const currency = "usd";
const deliveryCharge = 1; // USD
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ------------------------------- Place COD ------------------------------- */
const placeOrder = async (req, res) => {
  try {
    const { userId, items = [], address } = req.body;

    const itemsCents = itemsToCents(items);
    const shipCents = toCents(deliveryCharge);
    const totalCents = itemsCents + shipCents;

    const totalItems = items.reduce((s, i) => s + Number(i.quantity ?? 1), 0);

    const orderData = {
      userId,
      items,
      address,
      amount: Number(fromCents(totalCents)),
      numberOfItems: totalItems,
      paymentMethod: "COD",
      payment: false,
      date: Date.now(),
    };

    const newOrder = new orderModel(orderData);
    await newOrder.save();

    await decreaseStock(items);
    await userModel.findByIdAndUpdate(userId, { cartData: {} });

    res.json({ success: true, message: "Order Placed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* ------------------------------ Delete Order ----------------------------- */
const deleteOrder = async (req, res) => {
  try {
    await orderModel.findByIdAndDelete(req.body.id);
    res.json({ success: true, message: "Order Removed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* ---------------------------- Place Stripe Order ------------------------- */
const placeOrderStripe = async (req, res) => {
  try {
    const { userId, items = [], address } = req.body;
    const { origin } = req.headers;

    const itemsCents = itemsToCents(items);
    const shipCents = toCents(deliveryCharge);
    const totalCents = itemsCents + shipCents;

    const totalItems = items.reduce((s, i) => s + Number(i.quantity ?? 1), 0);

    const newOrder = new orderModel({
      userId,
      items,
      address,
      amount: Number(fromCents(totalCents)),
      numberOfItems: totalItems,
      paymentMethod: "Stripe",
      payment: false,
      date: Date.now(),
    });
    await newOrder.save();

    const line_items = items.map((item) => ({
      price_data: {
        currency,
        product_data: { name: item.name },
        unit_amount: toCents(item.price), // dùng cent
      },
      quantity: item.quantity,
    }));

    line_items.push({
      price_data: {
        currency,
        product_data: { name: "Delivery Charges" },
        unit_amount: shipCents,
      },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
      cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
      line_items,
      mode: "payment",
    });

    res.json({ success: true, session_url: session.url });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* -------------------------------- Verify -------------------------------- */
const verifyStripe = async (req, res) => {
  const { orderId, success, userId } = req.body;

  try {
    if (success === true || success === "true" || success === 1 || success === "1") {
      await orderModel.findByIdAndUpdate(orderId, { payment: true });
      await userModel.findByIdAndUpdate(userId, { cartData: {} });

      const order = await orderModel.findById(orderId);
      await decreaseStock(order.items);

      res.json({ success: true });
    } else {
      await orderModel.findByIdAndDelete(orderId);
      res.json({ success: false });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* ------------------------------ PayPal client ---------------------------- */
function paypalClient() {
  const env =
    process.env.PAYPAL_MODE === "live"
      ? new paypal.core.LiveEnvironment(
          process.env.PAYPAL_CLIENT_ID,
          process.env.PAYPAL_CLIENT_SECRET
        )
      : new paypal.core.SandboxEnvironment(
          process.env.PAYPAL_CLIENT_ID,
          process.env.PAYPAL_CLIENT_SECRET
        );
  return new paypal.core.PayPalHttpClient(env);
}

/* ----------------------------- Place PayPal ------------------------------ */
export const placeOrderPayPal = async (req, res) => {
  try {
    const { userId, items = [], address } = req.body;
    const { origin } = req.headers;

    // TÍNH TIỀN BẰNG CENT ở server
    const itemsCents = itemsToCents(items);
    const shipCents = toCents(deliveryCharge);
    const totalCents = itemsCents + shipCents;

    const totalItems = items.reduce((s, i) => s + Number(i.quantity ?? 1), 0);

    const newOrder = new orderModel({
      userId,
      items,
      address,
      amount: Number(fromCents(totalCents)),
      numberOfItems: totalItems,
      paymentMethod: "PayPal",
      payment: false,
      date: Date.now(),
    });
    await newOrder.save();

    // (Không bắt buộc) đính kèm danh sách item cho PayPal để đối soát
    const ppItems = items.map((it) => ({
      name: (it.name || "Product").slice(0, 120),
      unit_amount: { currency_code: "USD", value: fromCents(toCents(it.price)) },
      quantity: String(it.quantity || 1),
    }));

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: fromCents(totalCents), // CHỈ 2 DECIMALS
            breakdown: {
              item_total: { currency_code: "USD", value: fromCents(itemsCents) },
              shipping:   { currency_code: "USD", value: fromCents(shipCents) },
            },
          },
          items: ppItems,
        },
      ],
      application_context: {
        return_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
        cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
      },
    });

    const order = await paypalClient().execute(request);
    const approvalUrl = order.result.links.find((l) => l.rel === "approve").href;
    res.json({ success: true, approvalUrl });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

/* ------------------------------ Verify PayPal ---------------------------- */
export const verifyPayPal = async (req, res) => {
  try {
    const { orderId } = req.body; // ở FE cần truyền PAYPAL order id (token)
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    const capture = await paypalClient().execute(request);

    if (capture.result.status === "COMPLETED") {
      // map DB id ở FE để update nếu bạn đang lưu song song
      // (giữ nguyên luồng hiện tại của bạn)
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

/* --------------------------- Admin: all orders --------------------------- */
const allOrders = async (_req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* --------------------------- User orders (list) -------------------------- */
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    const orders = await orderModel.find({ userId });
    res.json({ success: true, orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* ------------------------------ Update status --------------------------- */
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await orderModel.findByIdAndUpdate(orderId, { status });
    res.json({ success: true, message: "Status Updated" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export const updateStatusBulk = async (req, res) => {
  try {
    const { orderIds, status } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: "orderIds rỗng" });
    }
    if (!status) {
      return res.status(400).json({ success: false, message: "Thiếu status" });
    }

    const result = await orderModel.updateMany(
      { _id: { $in: orderIds } },
      { $set: { status } }
    );

    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("updateStatusBulk error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ------------------------ User confirms received ------------------------ */
const confirmReceived = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    const s = String(order.status || "").toLowerCase();
    if (s.includes("cancel")) {
      return res.json({ success: false, message: "Order cancelled" });
    }

    const delivered = s.includes("delivered");
    const alreadyConfirmed = order.userConfirmed || s === "completed";

    if (!delivered && !alreadyConfirmed) {
      return res.json({ success: false, message: "Order not delivered yet" });
    }

    if (alreadyConfirmed) {
      return res.json({ success: true, message: "Order already confirmed" });
    }

    await orderModel.findByIdAndUpdate(orderId, {
      status: "Completed",
      userConfirmed: true,
      receivedAt: new Date(),
    });

    return res.json({ success: true, message: "Order confirmed" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* ------------------------------- Cancel order --------------------------- */
const cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    const s = String(order.status || "").toLowerCase();
    if (s.includes("delivered") || s === "completed") {
      return res.json({
        success: false,
        message: "Order already delivered — cannot cancel",
      });
    }
    if (s.includes("cancel")) {
      return res.json({ success: true, message: "Order already cancelled" });
    }

    await increaseStock(order.items);

    await orderModel.findByIdAndUpdate(orderId, {
      status: "Cancelled",
      cancelReason: reason || "",
      cancelAt: new Date(),
    });

    return res.json({ success: true, message: "Order cancelled" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

/* --------------------------- Refund (no media) -------------------------- */
const requestRefund = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const order = await orderModel.findById(orderId);
    if (!order) return res.json({ success: false, message: "Order not found" });

    const s = String(order.status || "").toLowerCase();
    const delivered = s.includes("delivered") || s === "completed";
    if (!delivered) {
      return res.json({ success: false, message: "Order not delivered yet" });
    }
    if (order.refundRequested) {
      return res.json({ success: true, message: "Refund already requested" });
    }

    await orderModel.findByIdAndUpdate(orderId, {
      refundRequested: true,
      refundReason: reason || "",
      refundStatus: "Pending",
      refundAt: new Date(),
    });

    return res.json({ success: true, message: "Refund request submitted" });
  } catch (e) {
    console.log(e);
    res.json({ success: false, message: e.message });
  }
};

/* ------------------- Upload config for refund evidence ------------------ */
const REFUND_DIR = path.join(__dirname, "..", "uploads", "refunds");
fs.mkdirSync(REFUND_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REFUND_DIR),
  filename: (req, file, cb) => {
    const safe = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, safe + path.extname(file.originalname || ""));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

// 20MB mỗi file
export const uploadRefundMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
}).fields([
  { name: "images", maxCount: 4 },
  { name: "video", maxCount: 1 },
]);

/* --------- Request refund with media (images x4 + video x1) ---------- */
export const requestRefundWithMedia = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, otherReason } = req.body;

    if (!reason) return res.status(400).json({ message: "Reason is required" });

    // Lấy userId từ middleware hoặc token (fallback)
    let userId = req.userId;
    if (!userId) {
      const bearer = req.headers?.authorization?.split(" ")[1];
      const token = req.headers?.token || bearer;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded?.id || decoded?._id;
        } catch {
          // ignore
        }
      }
    }
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const order = await orderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // So khớp chủ đơn nếu có đủ dữ liệu
    const owner = order.userId ?? order.user ?? order.user_id ?? order.userID ?? null;
    const ownerStr = owner ? String(owner) : null;
    const userStr = userId ? String(userId) : null;
    if (ownerStr && userStr && ownerStr !== userStr) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Build file paths
    const images = (req.files?.images || []).map((f) =>
      ("/uploads/refunds/" + path.basename(f.path)).replace(/\\/g, "/")
    );
    const video = req.files?.video?.[0]
      ? ("/uploads/refunds/" + path.basename(req.files.video[0].path)).replace(/\\/g, "/")
      : null;

    // Lưu vào order
    order.refundRequest = {
      status: "requested",
      reason,
      otherReason: otherReason || "",
      images,
      video,
      createdAt: new Date(),
    };
    // Đồng bộ các flag cũ để FE cũ vẫn đọc được
    order.refundRequested = true;
    order.refundStatus = "Pending";

    await order.save();
    return res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

export {
  verifyStripe,
  placeOrder,
  placeOrderStripe,
  allOrders,
  userOrders,
  updateStatus,
  deleteOrder,
  confirmReceived,
  cancelOrder,
  requestRefund,
};
