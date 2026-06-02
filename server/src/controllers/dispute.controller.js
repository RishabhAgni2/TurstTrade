import asyncHandler from 'express-async-handler';
import Dispute from '../models/dispute.model.js';
import Order from '../models/order.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { sendEmail } from '../utils/email.js';
import { notifyUser } from '../sockets/index.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// @POST /api/disputes
export const raiseDispute = asyncHandler(async (req, res) => {
  const { orderId, reason, description } = req.body;
  const order = await Order.findById(orderId).populate('buyer seller');
  if (!order) return errorResponse(res, 404, 'Order not found.');
  if (!['funded','delivered'].includes(order.escrowStatus))
    return errorResponse(res, 400, 'Can only dispute funded or delivered orders.');

  const against = order.buyer._id.toString() === req.user._id.toString() ? order.seller._id : order.buyer._id;

  // AI risk scoring
  let aiRiskScore = 0;
  try {
    const ai = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Rate fraud risk 0-100 for dispute: "${reason}. ${description}". Reply only with a number.` }],
      max_tokens: 5,
    });
    aiRiskScore = parseInt(ai.choices[0].message.content) || 0;
  } catch (_) {}

  const dispute = await Dispute.create({ order: orderId, raisedBy: req.user._id, against, reason, description, aiRiskScore });
  order.escrowStatus = 'disputed';
  order.timeline.push({ status: 'disputed', message: `Dispute raised: ${reason}` });
  await order.save();

  notifyUser(against.toString(), 'DISPUTE_RAISED', { disputeId: dispute._id, orderId });
  await sendEmail({ to: req.user.email, template: 'disputeRaised', data: dispute._id });

  successResponse(res, 201, 'Dispute raised. Our team will review within 48 hours.', { dispute });
});

// @GET /api/disputes
export const getDisputes = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : {
    $or: [{ raisedBy: req.user._id }, { against: req.user._id }]
  };
  const disputes = await Dispute.find(filter)
    .populate('raisedBy against', 'name email')
    .populate('order', 'amount escrowStatus')
    .sort({ createdAt: -1 });
  successResponse(res, 200, 'Disputes fetched.', { disputes });
});

// @PATCH /api/disputes/:id/resolve (admin only)
export const resolveDispute = asyncHandler(async (req, res) => {
  const { resolution, adminNotes } = req.body;
  const dispute = await Dispute.findById(req.params.id).populate('order');
  if (!dispute) return errorResponse(res, 404, 'Dispute not found.');

  dispute.status    = `resolved_${resolution}`;
  dispute.resolvedBy = req.user._id;
  dispute.resolvedAt = new Date();
  dispute.resolution = resolution;
  dispute.adminNotes = adminNotes;
  await dispute.save();

  successResponse(res, 200, 'Dispute resolved.', { dispute });
});
