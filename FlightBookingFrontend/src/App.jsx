import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import Availability from './pages/Availability';
import FlightBooking from './pages/FlightBooking';
import BookingConfirmation from './pages/BookingConfirmation';
import MyBookings from './pages/MyBookings';
import Coupons from './pages/Coupons';
import Profile from './pages/Profile';
import AvailableCreation from './pages/availableCreation';

// Layout & Protection
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { authUtil } from './utils/auth';

function RoleDashboardRedirect() {
  return <Navigate to={authUtil.isAdmin() ? '/admin-dashboard' : '/user-dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Application Routes inside Master Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleDashboardRedirect />} />
          <Route path="dashboard" element={<RoleDashboardRedirect />} />
          <Route
            path="admin-dashboard"
            element={
              <ProtectedRoute roles={['Admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="user-dashboard"
            element={
              <ProtectedRoute roles={['User']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="availability" element={<Availability />} />
          <Route path="booking" element={<FlightBooking />} />
          <Route path="ticket-booking" element={<FlightBooking />} />
          <Route path="booking-confirmation" element={<BookingConfirmation />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="profile" element={<Profile />} />
          <Route
            path="availableCreation"
            element={
              <ProtectedRoute>
                <AvailableCreation />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
