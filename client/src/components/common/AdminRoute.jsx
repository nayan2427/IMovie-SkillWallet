import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { sanitizeRedirectPath } from '../../utils/sanitizeRedirect.js';

export const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useSelector((state) => state.auth);
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const isVerified = Boolean(user && (user.isEmailVerified || user.isVerified || user.emailVerified));
  if (!isAuthenticated || user?.role !== 'admin' || !isVerified) {
    const safeRedirect = sanitizeRedirectPath(location.pathname + location.search, '/');
    return <Navigate to={`/login?redirect=${encodeURIComponent(safeRedirect)}`} replace />;
  }

  return children;
};
