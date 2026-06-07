import { AlertTriangle, Package, Users, Wallet } from 'lucide-react';

const stats = [
  { icon: Users, label: 'Total Users', value: '1,284', color: 'bg-blue-100 text-blue-600' },
  { icon: Wallet, label: 'Total Revenue', value: '₹48.2L', color: 'bg-green-100 text-green-600' },
  { icon: Package, label: 'Total Orders', value: '3,891', color: 'bg-yellow-100 text-yellow-600' },
  { icon: AlertTriangle, label: 'Open Disputes', value: '12', color: 'bg-red-100 text-red-600' },
];

const disputes = [
  ['iPhone 13 Pro', 'Item not as described', '87/100', 'Favor Buyer'],
  ['MacBook Air', 'Delayed delivery', '23/100', 'Favor Seller'],
  ['PS5 Console', 'Wrong item sent', '91/100', 'Favor Buyer'],
];

const AdminDashboard = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-bold text-gray-950">Admin Dashboard</h1>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-white border border-gray-200 rounded-xl p-6">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-4`}>
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-950">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      ))}
    </div>

    <div>
      <h2 className="text-sm font-semibold text-gray-950 mb-3">Recent Disputes — AI Risk Scores</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr><th className="text-left px-4 py-3">Order</th><th className="text-left px-4 py-3">Reason</th><th className="text-left px-4 py-3">AI Risk</th><th className="text-left px-4 py-3">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {disputes.map(([order, reason, risk, action]) => (
              <tr key={order}>
                <td className="px-4 py-4">{order}</td>
                <td className="px-4 py-4">{reason}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-2 py-1 text-xs ${risk.startsWith('2') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{risk}</span>
                </td>
                <td className="px-4 py-4"><button className="border border-gray-400 rounded-lg px-4 py-2 font-semibold hover:bg-gray-50">{action}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default AdminDashboard;
