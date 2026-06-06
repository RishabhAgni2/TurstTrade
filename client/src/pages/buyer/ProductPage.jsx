import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MapPin, Star, Shield, MessageSquare, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import api from '../../store/api/axios.js';
import Loader from '../../components/common/Loader.jsx';
import toast from 'react-hot-toast';

const ProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector(s => s.auth);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx]   = useState(0);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => setProduct(data.data.product))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBuyNow = async () => {
    if (!isAuthenticated) return navigate('/login');
    if (user?.role === 'seller' && product.seller._id === user._id)
      return toast.error("You can't buy your own product");
    setPlacing(true);
    try {
      const { data } = await api.post('/orders', { productId: product._id, deliveryMethod: 'shipping' });
      toast.success('Order placed!');
      navigate(`/orders/${data.data.order._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally { setPlacing(false); }
  };

  if (loading) return <Loader text="Loading product..." />;
  if (!product) return <div className="text-center py-16 text-gray-400">Product not found</div>;

  const imgs = product.images || [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3">
            <img src={imgs[imgIdx]?.url || '/placeholder.png'} className="w-full h-full object-cover" alt={product.title} />
            {imgs.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i-1+imgs.length)%imgs.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white rounded-full p-1.5 shadow">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setImgIdx(i => (i+1)%imgs.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white rounded-full p-1.5 shadow">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {imgs.map((img, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${i===imgIdx ? 'border-indigo-500' : 'border-transparent'}`}>
                <img src={img.url} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{product.category}</span>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{product.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
              <span className="capitalize bg-gray-100 px-2 py-0.5 rounded">{product.condition}</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{product.views} views</span>
              {product.location?.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{product.location.city}</span>}
            </div>
          </div>

          <p className="text-4xl font-bold text-gray-900">₹{product.price?.toLocaleString()}</p>

          {/* Escrow Banner */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3">
            <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-700">Protected by TrustTrade Escrow</p>
              <p className="text-xs text-indigo-500 mt-0.5">Your payment is held securely until you confirm delivery.</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Description</p>
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            {product.aiDescription && (
              <div className="mt-2 p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600 font-semibold mb-1">✨ AI Enhanced</p>
                <p className="text-sm text-purple-700">{product.aiDescription}</p>
              </div>
            )}
          </div>

          {/* Seller */}
          <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">
              {product.seller?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{product.seller?.name}</p>
              <div className="flex items-center gap-1 text-xs text-yellow-500">
                <Star className="w-3 h-3 fill-yellow-400" />
                {product.seller?.rating?.average?.toFixed(1) || '0.0'}
                <span className="text-gray-400">({product.seller?.rating?.count || 0} reviews)</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleBuyNow} disabled={placing || product.status !== 'active'}
              className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
              {placing ? 'Placing Order...' : '🔒 Buy Securely'}
            </button>
            <button className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
          {product.status !== 'active' && (
            <p className="text-center text-sm text-red-500">This product is no longer available</p>
          )}
        </div>
      </div>
    </div>
  );
};
export default ProductPage;
