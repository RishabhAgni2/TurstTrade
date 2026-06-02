import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import razorpay from '../config/razorpay.js';
import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import { sendEmail } from '../utils/email.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { getRedis } from '../config/redis.js';
import { notifyUser } from '../sockets/index.js';
import { scheduleAutoRelease } from '../jobs/escrow.job.js';
import { generateIdempotencyKey } from '../utils/jwt.js';

// @POST /api/payments/create-order  — Create Razorpay Order
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId).populate('product seller buyer');

  if (!order) return errorResponse(res, 404, 'Order not found.');
  if (order.buyer.toString() !== req.user._id.toString())
    return errorResponse(res, 403, 'Not your order.');
  if (order.escrowStatus !== 'pending')
    return errorResponse(res, 400, 'Order already processed.');

  // Idempotency — prevent duplicate orders
  const redis = getRedis();
  const idempKey = generateIdempotencyKey();
  const lockKey  = `payment_lock:${orderId}`;
  const existing = await redis.get(lockKey);
  if (existing) return errorResponse(res, 409, 'Payment already in progress.');
  await redis.setex(lockKey, 300, idempKey); // 5 min lock

  const platformFee  = Math.round(order.amount * 0.02); // 2%
  const sellerAmount = order.amount - platformFee;

  const razorpayOrder = await razorpay.orders.create({
    amount:   order.amount * 100, // paise
    currency: 'INR',
    receipt:  `order_${orderId}`,
    notes:    { orderId, buyerId: req.user._id.toString() },
  });

  order.payment.razorpayOrderId  = razorpayOrder.id;
  order.payment.idempotencyKey   = idempKey;
  order.platformFee              = platformFee;
  order.sellerAmount             = sellerAmount;
  await order.save();

  successResponse(res, 200, 'Payment order created.', {
    razorpayOrderId: razorpayOrder.id,
    amount:          razorpayOrder.amount,
    currency:        razorpayOrder.currency,
    key:             process.env.RAZORPAY_KEY_ID,
  });
});

// @POST /api/payments/webhook  — Razorpay Webhook (Escrow Fund)
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body      = JSON.stringify(req.body);

  // Verify webhook signature
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expectedSig)
    return errorResponse(res, 400, 'Invalid webhook signature.');

  const event   = req.body.event;
  const payload = req.body.payload?.payment?.entity;

  if (event === 'payment.captured') {
    const order = await Order.findOne({
      'payment.razorpayOrderId': payload.order_id,
    }).populate('buyer seller product');

    if (!order) return res.status(200).json({ received: true });

    // Idempotency check — prevent double processing
    const redis = getRedis();
    const processedKey = `webhook_processed:${payload.id}`;
    const alreadyDone  = await redis.get(processedKey);
    if (alreadyDone)   return res.status(200).json({ received: true, idempotent: true });

    // Mark processed
    await redis.setex(processedKey, 86400, '1'); // 24hr

    // ESCROW: funds held
    order.payment.razorpayPaymentId = payload.id;
    order.payment.method            = payload.method;
    order.payment.status            = 'paid';
    order.escrowStatus              = 'funded';
    order.escrowHeldAt              = new Date();
    order.timeline.push({ status: 'funded', message: 'Payment received and held in escrow.' });
    await order.save();

    // Mark product as sold
    await import('../models/product.model.js').then(({ default: Product }) =>
      Product.findByIdAndUpdate(order.product._id, { status: 'sold' })
    );

    // Notify both parties via Socket.io
    notifyUser(order.buyer._id.toString(),  'ORDER_FUNDED',   { orderId: order._id });
    notifyUser(order.seller._id.toString(), 'ORDER_FUNDED',   { orderId: order._id });

    // Email buyer
    await sendEmail({ to: order.buyer.email, template: 'orderPlaced', data: order });

    // Schedule auto-release after 7 days
    await scheduleAutoRelease(order._id.toString(), 7 * 24 * 60 * 60 * 1000);
  }

  res.status(200).json({ received: true });
});

// @POST /api/payments/confirm-delivery/:orderId  — Buyer confirms delivery
export const confirmDelivery = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId).populate('seller buyer');

  if (!order) return errorResponse(res, 404, 'Order not found.');
  if (order.buyer._id.toString() !== req.user._id.toString())
    return errorResponse(res, 403, 'Only buyer can confirm delivery.');
  if (order.escrowStatus !== 'funded' && order.escrowStatus !== 'delivered')
    return errorResponse(res, 400, `Cannot confirm in status: ${order.escrowStatus}`);

  // ESCROW RELEASE — add to seller wallet
  const seller = await User.findById(order.seller._id);
  seller.wallet.balance += order.sellerAmount;
  await seller.save();

  order.escrowStatus          = 'released';
  order.fundsReleasedAt       = new Date();
  order.delivery.deliveredAt  = new Date();
  order.timeline.push({ status: 'released', message: 'Buyer confirmed delivery. Funds released to seller.' });
  await order.save();

  notifyUser(order.seller._id.toString(), 'FUNDS_RELEASED', { orderId: order._id, amount: order.sellerAmount });
  await sendEmail({ to: order.seller.email, template: 'fundsReleased', data: order.sellerAmount });

  successResponse(res, 200, 'Delivery confirmed. Funds released to seller.', { order });
});

// @POST /api/payments/release-auto/:orderId  — Auto release (called by job)
export const autoReleaseEscrow = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId).populate('seller');
  if (!order || order.escrowStatus !== 'funded') return res.json({ skipped: true });

  const seller = await User.findById(order.seller._id);
  seller.wallet.balance += order.sellerAmount;
  await seller.save();

  order.escrowStatus    = 'released';
  order.fundsReleasedAt = new Date();
  order.timeline.push({ status: 'released', message: 'Funds auto-released after 7 days.' });
  await order.save();

  notifyUser(order.seller._id.toString(), 'FUNDS_RELEASED', { orderId: order._id, amount: order.sellerAmount });
  await sendEmail({ to: order.seller.email, template: 'fundsReleased', data: order.sellerAmount });

  res.json({ success: true });
});

// @GET /api/payments/wallet  — Get wallet balance
export const getWallet = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('wallet');
  successResponse(res, 200, 'Wallet fetched.', { wallet: user.wallet });
});
