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

const fundOrderFromPayment = async (order, payload) => {
  order.payment.razorpayPaymentId = payload.id;
  order.payment.method = payload.method;
  order.payment.status = 'paid';
  order.escrowStatus = 'funded';
  order.escrowHeldAt = new Date();
  order.timeline.push({ status: 'funded', message: 'Payment received and held in escrow.' });
  await order.save();

  await import('../models/product.model.js').then(({ default: Product }) =>
    Product.findByIdAndUpdate(order.product._id || order.product, { status: 'sold' })
  );

  notifyUser(order.buyer._id.toString(), 'ORDER_FUNDED', { orderId: order._id });
  notifyUser(order.seller._id.toString(), 'ORDER_FUNDED', { orderId: order._id });

  await sendEmail({ to: order.buyer.email, template: 'orderPlaced', data: order });
  await scheduleAutoRelease(order._id.toString(), 7 * 24 * 60 * 60 * 1000);
};

export const createPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId).populate('product seller buyer');

  if (!order) return errorResponse(res, 404, 'Order not found.');
  if (order.buyer._id.toString() !== req.user._id.toString())
    return errorResponse(res, 403, 'Not your order.');
  if (order.escrowStatus !== 'pending')
    return errorResponse(res, 400, 'Order already processed.');

  const redis = getRedis();
  const idempKey = generateIdempotencyKey();
  const lockKey = `payment_lock:${orderId}`;
  const existing = await redis.get(lockKey);
  if (existing) return errorResponse(res, 409, 'Payment already in progress.');
  await redis.setex(lockKey, 300, idempKey);

  const platformFee = Math.round(order.amount * 0.02);
  const sellerAmount = order.amount - platformFee;

  const razorpayOrder = await razorpay.orders.create({
    amount: order.amount * 100,
    currency: 'INR',
    receipt: `order_${orderId}`,
    notes: { orderId, buyerId: req.user._id.toString() },
  });

  order.payment.razorpayOrderId = razorpayOrder.id;
  order.payment.idempotencyKey = idempKey;
  order.platformFee = platformFee;
  order.sellerAmount = sellerAmount;
  await order.save();

  successResponse(res, 200, 'Payment order created.', {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key: process.env.RAZORPAY_KEY_ID,
  });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return errorResponse(res, 400, 'Missing payment verification data.');

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== razorpay_signature)
    return errorResponse(res, 400, 'Invalid payment signature.');

  const order = await Order.findOne({ 'payment.razorpayOrderId': razorpay_order_id })
    .populate('buyer seller product');

  if (!order) return errorResponse(res, 404, 'Order not found.');
  if (order.buyer._id.toString() !== req.user._id.toString())
    return errorResponse(res, 403, 'Not your order.');

  if (order.escrowStatus === 'funded')
    return successResponse(res, 200, 'Payment already verified.', { order });
  if (order.escrowStatus !== 'pending')
    return errorResponse(res, 400, `Cannot verify payment in status: ${order.escrowStatus}`);

  await fundOrderFromPayment(order, {
    id: razorpay_payment_id,
    method: 'razorpay_checkout',
  });

  successResponse(res, 200, 'Payment verified. Funds held in escrow.', { order });
});

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expectedSig)
    return errorResponse(res, 400, 'Invalid webhook signature.');

  const parsedBody = Buffer.isBuffer(req.body) ? JSON.parse(body) : req.body;
  const event = parsedBody.event;
  const payload = parsedBody.payload?.payment?.entity;

  if (event === 'payment.captured' && payload) {
    const order = await Order.findOne({
      'payment.razorpayOrderId': payload.order_id,
    }).populate('buyer seller product');

    if (!order) return res.status(200).json({ received: true });

    const redis = getRedis();
    const processedKey = `webhook_processed:${payload.id}`;
    const alreadyDone = await redis.get(processedKey);
    if (alreadyDone) return res.status(200).json({ received: true, idempotent: true });

    await redis.setex(processedKey, 86400, '1');
    if (order.escrowStatus === 'pending') await fundOrderFromPayment(order, payload);
  }

  res.status(200).json({ received: true });
});

export const confirmDelivery = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId).populate('seller buyer');

  if (!order) return errorResponse(res, 404, 'Order not found.');
  if (order.buyer._id.toString() !== req.user._id.toString())
    return errorResponse(res, 403, 'Only buyer can confirm delivery.');
  if (order.escrowStatus !== 'funded' && order.escrowStatus !== 'delivered')
    return errorResponse(res, 400, `Cannot confirm in status: ${order.escrowStatus}`);

  const seller = await User.findById(order.seller._id);
  seller.wallet.balance += order.sellerAmount;
  seller.totalSales = (seller.totalSales || 0) + 1;
  await seller.save();

  order.escrowStatus = 'released';
  order.fundsReleasedAt = new Date();
  order.delivery.deliveredAt = new Date();
  order.timeline.push({ status: 'released', message: 'Buyer confirmed delivery. Funds released to seller.' });
  await order.save();

  notifyUser(order.seller._id.toString(), 'FUNDS_RELEASED', { orderId: order._id, amount: order.sellerAmount });
  await sendEmail({ to: order.seller.email, template: 'fundsReleased', data: order.sellerAmount });

  successResponse(res, 200, 'Delivery confirmed. Funds released to seller.', { order });
  
});


export const autoReleaseEscrow = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId).populate('seller');
  if (!order || order.escrowStatus !== 'funded') return res.json({ skipped: true });

  const seller = await User.findById(order.seller._id);
  seller.wallet.balance += order.sellerAmount;
  seller.totalSales = (seller.totalSales || 0) + 1;
  await seller.save();

  order.escrowStatus = 'released';
  order.fundsReleasedAt = new Date();
  order.timeline.push({ status: 'released', message: 'Funds auto-released after 7 days.' });
  await order.save();

  notifyUser(order.seller._id.toString(), 'FUNDS_RELEASED', { orderId: order._id, amount: order.sellerAmount });
  await sendEmail({ to: order.seller.email, template: 'fundsReleased', data: order.sellerAmount });

  res.json({ success: true });
});

export const getWallet = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('wallet');
  successResponse(res, 200, 'Wallet fetched.', { wallet: user.wallet });
});
