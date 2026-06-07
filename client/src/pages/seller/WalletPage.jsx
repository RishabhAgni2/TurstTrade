const transactions = [
  { label: 'iPhone 13 Pro sold', amount: 60760, type: 'credit' },
  { label: 'MacBook Air M2 sold', amount: 87220, type: 'credit' },
  { label: 'PS5 Console sold', amount: 41160, type: 'credit' },
  { label: 'Bank withdrawal', amount: 100000, type: 'debit' },
];

const WalletPage = () => (
  <div className="max-w-3xl mx-auto space-y-6">
    <h1 className="text-2xl font-bold text-gray-950">My Wallet</h1>

    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-10 text-white text-center">
      <p className="text-indigo-100 text-sm font-medium">Available Balance</p>
      <p className="text-5xl font-bold mt-3">₹2,34,500</p>
      <p className="text-indigo-100 text-sm mt-2">INR · TrustTrade Wallet</p>
      <button className="mt-6 px-8 py-2.5 rounded-lg border border-white/40 bg-white/10 font-semibold text-sm hover:bg-white/20 transition">
        Withdraw to Bank
      </button>
    </div>

    <div>
      <h2 className="text-sm font-semibold text-gray-950 mb-3">Recent Transactions</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {transactions.map(transaction => (
          <div key={transaction.label} className="flex items-center justify-between px-5 py-4 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${transaction.type === 'credit' ? 'bg-indigo-600' : 'bg-orange-500'}`} />
              <span className="text-sm text-gray-700">{transaction.label}</span>
            </div>
            <span className={`text-sm font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
              {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default WalletPage;
