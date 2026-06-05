import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingBag, Bell, MessageSquare, User, LogOut, Shield } from 'lucide-react';
import { logoutUser } from '../../store/slices/auth.slice.js';
import NotificationBell from '../common/NotificationBell.jsx';

const Navbar = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { user, isAuthenticated } = useSelector(state => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <Shield className="w-6 h-6" />
          TrustTrade
        </Link>

        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <input
            type="text"
            placeholder="Search products..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/?search=${e.target.value}`)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <Link to="/chat" className="p-2 text-gray-500 hover:text-indigo-600 transition">
                <MessageSquare className="w-5 h-5" />
              </Link>
              {user?.role === 'seller' && (
                <Link to="/seller" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Dashboard
                </Link>
              )}
              {user?.role === 'admin' && (
                <Link to="/admin" className="text-sm font-medium text-red-600 hover:text-red-700">
                  Admin
                </Link>
              )}
              <Link to="/profile" className="p-2 text-gray-500 hover:text-indigo-600 transition">
                {user?.avatar
                  ? <img src={user.avatar} className="w-7 h-7 rounded-full object-cover" alt="avatar" />
                  : <User className="w-5 h-5" />
                }
              </Link>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login"    className="text-sm text-gray-600 hover:text-indigo-600">Login</Link>
              <Link to="/register" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
