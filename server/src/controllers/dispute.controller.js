import asyncHandler from 'express-async-handler';
import Dispute from '../models/dispute.model.js';
import Order from '../models/order.model.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { sendEmail } from '../utils/email.js';
import { notifyUser } from '../sockets/index.js';
import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;

  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
};

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
    const genAI = getGeminiClient();
    if (!genAI) throw new Error('GEMINI_API_KEY is not configured');

    const response = await genAI.models.generateContent({
  model: "gemini-2.5-flash",
  contents: `Rate fraud risk from 0 to 100 for this dispute.

Reason: ${reason}
Description: ${description}

Reply ONLY with a number.`
});

const text = response.text?.trim() || "0";

aiRiskScore = parseInt(text, 10) || 0;
  } catch (err) {
    console.log('AI skip:', err.message);
  }

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
