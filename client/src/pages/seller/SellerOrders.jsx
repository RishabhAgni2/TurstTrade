import { useEffect, useState } from 'react';
import { Wallet, ArrowDownCircle, TrendingUp } from 'lucide-react';
import api from '../../store/api/axios.js';
import Loader from '../../components/common/Loader.jsx';

const WalletPage = () => {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/wallet').then(({ data }) => setWallet(data.data.wallet))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading wallet..." />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Wallet</h1>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="w-6 h-6 text-indigo-200" />
          <span className="text-indigo-200 text-sm">Available Balance</span>
        </div>
        <p className="text-5xl font-bold">₹{(wallet?.balance || 0).toLocaleString()}</p>
        <p className="text-indigo-200 text-sm mt-2">{wallet?.currency || 'INR'}</p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <TrendingUp className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-sm text-gray-500">Total Earned</p>
          <p className="text-xl font-bold text-gray-900">₹{(wallet?.balance || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <ArrowDownCircle className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-sm text-gray-500">Pending in Escrow</p>
          <p className="text-xl font-bold text-gray-900">₹0</p>
        </div>
      </div>

      {/* Withdraw */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Withdraw Funds</h2>
        <p className="text-sm text-gray-500 mb-4">Withdrawals are processed within 1-3 business days to your registered bank account.</p>
        <input type="number" placeholder="Enter amount" max={wallet?.balance}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition">
          Withdraw to Bank
        </button>
      </div>
    </div>
  );
};
export default WalletPage;
