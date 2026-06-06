import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Clock, Truck, AlertTriangle, DollarSign } from 'lucide-react';
import api from '../../store/api/axios.js';
import EscrowBadge from '../../components/common/EscrowBadge.jsx';
import Loader from '../../components/common/Loader.jsx';
import { usePayment } from '../../hooks/usePayment.js';
import toast from 'react-hot-toast';

const steps = [
  { key: 'pending',   icon: Clock,        label: 'Order Placed' },
  { key: 'funded',    icon: DollarSign,   label: 'Payment in Escrow' },
  { key: 'delivered', icon: Truck,        label: 'Delivered' },
  { key: 'released',  icon: CheckCircle,  label: 'Funds Released' },
];

const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { initiatePayment, confirmDelivery, loading: paymentLoading } = usePayment();

  const fetchOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.data.order);
    } catch { toast.error('Failed to load order'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  if (loading) return <Loader text="Loading order..." />;
  if (!order)  return <div className="text-center py-12 text-gray-400">Order not found</div>;

  const currentStepIdx = steps.findIndex(s => s.key === order.escrowStatus);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">Order Details</h1>
          <EscrowBadge status={order.escrowStatus} />
        </div>
        <p className="text-sm text-gray-400 font-mono">#{order._id}</p>
      </div>

      {/* Escrow Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-6 uppercase tracking-wide">Escrow Timeline</h2>
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const done = idx <= currentStepIdx;
            const active = idx === currentStepIdx;
            return (
              <div key={step.key} className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${done ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className={`text-xs mt-2 text-center font-medium ${active ? 'text-indigo-600' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {idx < steps.length - 1 && (
                  <div className="hidden" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Product */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex gap-4">
        <img src={order.product?.images?.[0]?.url || '/placeholder.png'} className="w-20 h-20 object-cover rounded-lg" alt="" />
        <div>
          <h3 className="font-semibold text-gray-800">{order.product?.title}</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">₹{order.amount?.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Platform fee: ₹{order.platformFee} | Seller gets: ₹{order.sellerAmount}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        {order.escrowStatus === 'pending' && (
          <button onClick={() => initiatePayment(order._id, fetchOrder)} disabled={paymentLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
            {paymentLoading ? 'Processing...' : '🔒 Pay Securely (Escrow)'}
          </button>
        )}
        {(order.escrowStatus === 'funded' || order.escrowStatus === 'delivered') && (
          <button onClick={() => confirmDelivery(order._id, fetchOrder)} disabled={paymentLoading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
            {paymentLoading ? 'Confirming...' : '✅ Confirm Delivery & Release Funds'}
          </button>
        )}
        {order.escrowStatus === 'funded' && (
          <button className="w-full border border-red-200 text-red-600 py-3 rounded-lg font-medium hover:bg-red-50 transition">
            ⚠️ Raise a Dispute
          </button>
        )}
        {order.escrowStatus === 'released' && (
          <div className="text-center text-green-600 font-semibold py-3">
            ✅ Transaction Complete — Funds Released to Seller
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Activity Log</h2>
        <div className="space-y-3">
          {order.timeline?.map((t, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-gray-700">{t.message}</p>
                <p className="text-xs text-gray-400">{new Date(t.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default OrderDetailPage;
