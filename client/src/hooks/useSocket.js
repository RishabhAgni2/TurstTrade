import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { addNotification } from '../store/slices/ui.slice.js';
import { updateOrderStatus } from '../store/slices/order.slice.js';
import { addMessage } from '../store/slices/chat.slice.js';
import { SOCKET_URL } from '../constants/index.js';

export const useSocket = (user) => {
  const socketRef = useRef(null);
  const dispatch  = useDispatch();

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('accessToken');
    socketRef.current = io(SOCKET_URL, { auth: { token }, withCredentials: true });

    const socket = socketRef.current;

    socket.on('ORDER_FUNDED', (data) => {
      dispatch(addNotification({ type: 'order', message: 'Payment received! Escrow funded.', data }));
      dispatch(updateOrderStatus({ orderId: data.orderId, status: 'funded' }));
    });

    socket.on('FUNDS_RELEASED', (data) => {
      dispatch(addNotification({ type: 'payment', message: `₹${data.amount} released to your wallet!`, data }));
      dispatch(updateOrderStatus({ orderId: data.orderId, status: 'released' }));
    });

    socket.on('NEW_MESSAGE', ({ message }) => {
      dispatch(addMessage(message));
    });

    socket.on('connect_error', (err) => console.error('Socket error:', err.message));

    return () => { socket.disconnect(); };
  }, [user, dispatch]);

  return socketRef;
};
