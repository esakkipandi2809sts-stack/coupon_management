import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, User, Mail, Phone, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '../services/api';

function readRegistrationError(error) {
  const responseData = error.response?.data;
  const fieldErrors = {};

  if (responseData?.errors && typeof responseData.errors === 'object') {
    Object.entries(responseData.errors).forEach(([field, messages]) => {
      const formField = field.charAt(0).toLowerCase() + field.slice(1);
      const message = Array.isArray(messages) ? messages[0] : messages;
      if (typeof message === 'string' && message) {
        fieldErrors[formField] = message;
      }
    });
  }

  const validationMessage = Object.values(fieldErrors).join(' ');
  const message = responseData?.message
    || validationMessage
    || responseData?.title
    || (error.request
      ? 'Unable to reach the Flight Booking server. Check that the backend is running, then try again.'
      : 'Registration could not be completed. Please try again.');

  return { message, fieldErrors };
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = 'Full Name is required (at least 2 characters)';
    }

    if (!formData.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = 'Invalid email address format';
    }

    if (!formData.phoneNumber.trim()) {
      errs.phoneNumber = 'Phone number is required';
    }

    if (!formData.password) {
      errs.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errs.confirmPassword = 'Confirm Password is required';
    } else if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validate()) return;

    setLoading(true);
    try {
      await authApi.register(formData);
      // Navigate to login with success message
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      const registrationError = readRegistrationError(err);
      setErrors((currentErrors) => ({ ...currentErrors, ...registrationError.fieldErrors }));
      setErrorMessage(registrationError.message);
    } finally {
      setLoading(false);
    }
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
          maxWidth: '520px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '40px 36px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          animation: 'fadeIn 0.4s ease'
        }}
      >
        {/* App Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 14px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
            }}
          >
            <Plane size={30} color="#ffffff" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Create AeroWings Account
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>
            Join thousands of travelers enjoying special flight coupon discounts
          </p>
        </div>

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

        {/* Register Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 42px',
                  borderRadius: '12px',
                  border: `1px solid ${errors.fullName ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
            {errors.fullName && <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{errors.fullName}</span>}
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 42px',
                  borderRadius: '12px',
                  border: `1px solid ${errors.email ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
            {errors.email && <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{errors.email}</span>}
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
              Phone Number
            </label>
            <div style={{ position: 'relative' }}>
              <Phone
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="tel"
                placeholder="+1 555-0199"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 42px',
                  borderRadius: '12px',
                  border: `1px solid ${errors.phoneNumber ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
            {errors.phoneNumber && <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{errors.phoneNumber}</span>}
          </div>

          {/* Password & Confirm in 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={18}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 36px 11px 36px',
                    borderRadius: '12px',
                    border: `1px solid ${errors.password ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', color: '#94a3b8' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{errors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={18}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 36px 11px 36px',
                    borderRadius: '12px',
                    border: `1px solid ${errors.confirmPassword ? '#ef4444' : '#cbd5e1'}`,
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', color: '#94a3b8' }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && <span style={{ fontSize: '0.74rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{errors.confirmPassword}</span>}
            </div>
          </div>

          {/* Submit */}
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
              marginTop: '12px'
            }}
          >
            {loading ? (
              <span>Creating account...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: '#64748b' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
