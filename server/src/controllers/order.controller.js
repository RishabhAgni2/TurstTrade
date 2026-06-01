import asyncHandler from 'express-async-handler';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

// @POST /api/orders — Place order
export const placeOrder = asyncHandler(async (req, res) => {
  const { productId, deliveryMethod, address, notes } = req.body;

  const product = await Product.findById(productId).populate('seller');
  if (!product)              return errorResponse(res, 404, 'Product not found.');
  if (product.status !== 'active') return errorResponse(res, 400, 'Product not available.');
  if (product.seller._id.toString() === req.user._id.toString())
    return errorResponse(res, 400, 'Cannot buy your own product.');

  const order = await Order.create({
    buyer:   req.user._id,
    seller:  product.seller._id,
    product: product._id,
    amount:  product.price,
    delivery: { method: deliveryMethod || 'shipping', address },
    notes,
    timeline: [{ status: 'pending', message: 'Order placed. Awaiting payment.' }],
  });

  successResponse(res, 201, 'Order placed. Proceed to payment.', { order });
});

// @GET /api/orders/my — Get user orders
export const getMyOrders = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 10, status } = req.query;
  const filter = role === 'seller'
    ? { seller: req.user._id }
    : { buyer: req.user._id };
  if (status) filter.escrowStatus = status;

  const orders = await Order.find(filter)
    .populate('product', 'title images price')
    .populate('buyer seller', 'name avatar email rating')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Order.countDocuments(filter);
  successResponse(res, 200, 'Orders fetched.', {
    orders, total, page: parseInt(page), totalPages: Math.ceil(total / limit),
  });
});

// @GET /api/orders/:id — Get order by ID
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('product')
    .populate('buyer seller', 'name avatar email rating wallet');

  if (!order) return errorResponse(res, 404, 'Order not found.');
  const isParty = [order.buyer._id, order.seller._id]
    .some(id => id.toString() === req.user._id.toString());
  if (!isParty && req.user.role !== 'admin')
    return errorResponse(res, 403, 'Access denied.');

  successResponse(res, 200, 'Order fetched.', { order });
});

// @PATCH /api/orders/:id/mark-delivered — Seller marks as delivered
export const markDelivered = asyncHandler(async (req, res) => {
  const { trackingId } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return errorResponse(res, 404, 'Order not found.');
  if (order.seller.toString() !== req.user._id.toString())
    return errorResponse(res, 403, 'Only seller can mark delivered.');
  if (order.escrowStatus !== 'funded')
    return errorResponse(res, 400, 'Order must be funded to mark delivered.');

  order.escrowStatus        = 'delivered';
  order.delivery.trackingId = trackingId;
  order.delivery.deliveredAt = new Date();
  order.timeline.push({ status: 'delivered', message: 'Seller marked as delivered.' });
  await order.save();

  successResponse(res, 200, 'Order marked as delivered.', { order });
});

// @PATCH /api/orders/:id/cancel — Cancel order
export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return errorResponse(res, 404, 'Order not found.');

  const isParty = [order.buyer, order.seller]
    .some(id => id.toString() === req.user._id.toString());
  if (!isParty) return errorResponse(res, 403, 'Access denied.');
  if (!['pending'].includes(order.escrowStatus))
    return errorResponse(res, 400, 'Cannot cancel after payment is made.');

  order.escrowStatus       = 'cancelled';
  order.cancellationReason = reason;
  order.timeline.push({ status: 'cancelled', message: `Cancelled: ${reason}` });
  await order.save();

  successResponse(res, 200, 'Order cancelled.', { order });
});
