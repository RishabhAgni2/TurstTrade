import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from './store/slices/auth.slice.js';
import { useSocket } from './hooks/useSocket.js';
import api from './store/api/axios.js';

// Layouts — branch 8 mein banenge
// import MainLayout      from './components/layout/MainLayout.jsx';
// import DashboardLayout from './components/layout/DashboardLayout.jsx';

// Guards
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import RoleRoute      from './components/auth/RoleRoute.jsx';

// Placeholder pages — branch 9 mein replace honge
const Placeholder = ({ name }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-indigo-600">{name}</h2>
      <p className="text-gray-500 mt-2">Page under construction</p>
    </div>
  </div>
);

function App() {
  const dispatch = useDispatch();
  const { user } = useSelector(s => s.auth);
  useSocket(user);

  // Session restore — page refresh pe user logged in rahe
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      try {
        const { data } = await api.get('/users/me');
        dispatch(setUser(data.data.user));
      } catch {
        localStorage.removeItem('accessToken');
      }
    };
    restoreSession();
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — placeholder */}
        <Route path="/"         element={<Placeholder name="Home" />} />
        <Route path="/login"    element={<Placeholder name="Login" />} />
        <Route path="/register" element={<Placeholder name="Register" />} />

        {/* Protected — placeholder */}
        <Route path="/orders" element={
          <ProtectedRoute>
            <Placeholder name="My Orders" />
          </ProtectedRoute>
        } />

        {/* Seller — placeholder */}
        <Route path="/seller" element={
          <RoleRoute roles={['seller', 'admin']}>
            <Placeholder name="Seller Dashboard" />
          </RoleRoute>
        } />

        {/* Admin — placeholder */}
        <Route path="/admin" element={
          <RoleRoute roles={['admin']}>
            <Placeholder name="Admin Dashboard" />
          </RoleRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;