import { useState } from 'react';
import api from '../store/api/axios.js';
import toast from 'react-hot-toast';

export const usePayment = () => {
  const [loading, setLoading] = useState(false);

  const initiatePayment = async (orderId, onSuccess) => {
    setLoading(true);
    try {
      const { data } = await api.post('/payments/create-order', { orderId });
      const { razorpayOrderId, amount, currency, key } = data.data;

      const options = {
        key,
        amount,
        currency,
        order_id: razorpayOrderId,
        name:     'TrustTrade',
        description: 'Secure Escrow Payment',
        theme:    { color: '#6366f1' },
        handler: async (response) => {
          await api.post('/payments/verify', response);
          toast.success('Payment successful! Funds held in escrow.');
          onSuccess?.(response);
        },
        modal: {
          ondismiss: () => toast.error('Payment cancelled.'),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed.');
    } finally { setLoading(false); }
  };

  const confirmDelivery = async (orderId, onSuccess) => {
    setLoading(true);
    try {
      await api.post(`/payments/confirm-delivery/${orderId}`);
      toast.success('Delivery confirmed! Funds released to seller.');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm delivery.');
    } finally { setLoading(false); }
  };

  return { initiatePayment, confirmDelivery, loading };
};
