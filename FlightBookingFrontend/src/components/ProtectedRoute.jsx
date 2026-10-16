import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authUtil } from '../utils/auth';

export default function ProtectedRoute({ children, roles, deniedPath = '/dashboard' }) {
  const location = useLocation();
  const isAuthenticated = authUtil.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(authUtil.getRole())) {
    return <Navigate to={deniedPath} state={{ accessDenied: true }} replace />;
  }

  return children;
}
