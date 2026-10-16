import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plane, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { authApi } from '../services/api';
import { authUtil } from '../utils/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(location.state?.registered ? 'Registration successful. Please login.' : '');

  // Form validation errors
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const errs = {};
    if (!username.trim()) errs.username = 'Username is required';

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessNotice('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await authApi.login({ username, password });
      const { token, user } = response.data;

      authUtil.setToken(token);
      authUtil.setUser(user);

      navigate(user.role?.toLowerCase() === 'admin' ? '/admin-dashboard' : '/user-dashboard', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid username or password';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail) => {
    setUsername(demoEmail);
    setPassword('Password123!');
    setErrors({});
    setErrorMessage('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(2, 132, 199, 0.25) 0%, transparent 45%), radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.2) 0%, transparent 40%)',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '40px 36px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          animation: 'fadeIn 0.4s ease'
        }}
      >
        {/* App Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 16px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
            }}
          >
            <Plane size={32} color="#ffffff" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            AeroWings
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: '4px' }}>
            Flight Ticket Booking & Coupon Management
          </p>
        </div>

        {/* Success Registration Notice */}
        {successNotice && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '0.88rem'
            }}
          >
            <CheckCircle2 size={18} color="#059669" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Error Notice */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '0.88rem'
            }}
          >
            <AlertCircle size={18} color="#dc2626" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Username field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="example@gmail.com"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors({ ...errors, username: '' });
                }}
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 42px',
                  borderRadius: '12px',
                  border: `1px solid ${errors.username ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0284c7'; }}
                onBlur={(e) => { if (!errors.username) e.target.style.borderColor = '#cbd5e1'; }}
              />
            </div>
            {errors.username && (
              <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                {errors.username}
              </span>
            )}
          </div>

          {/* Password field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Password
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 42px',
                  borderRadius: '12px',
                  border: `1px solid ${errors.password ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0284c7'; }}
                onBlur={(e) => { if (!errors.password) e.target.style.borderColor = '#cbd5e1'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  color: '#94a3b8',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                {errors.password}
              </span>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              padding: '13px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              opacity: loading ? 0.75 : 1,
              marginTop: '8px'
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#0369a1'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#0284c7'; }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Account</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div style={{ marginTop: '24px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '8px', textAlign: 'center' }}>
            Quick Demo Login (Password: Password123!)
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => handleQuickFill('john.doe@example.com')}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0284c7',
                fontWeight: 600
              }}
            >
              John Doe
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('sarah.c@example.com')}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0284c7',
                fontWeight: 600
              }}
            >
              Sarah Connor
            </button>
          </div>
        </div>

        {/* Footer: Register Option */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: '#64748b' }}>
          Don't have an account yet?{' '}
          <Link
            to="/register"
            style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
