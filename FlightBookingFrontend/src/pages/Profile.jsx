import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, ShieldCheck, CheckCircle2, AlertCircle, Save, Award, Ticket } from 'lucide-react';
import { userApi, bookingApi } from '../services/api';
import { authUtil } from '../utils/auth';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [bookingCount, setBookingCount] = useState(0);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await userApi.getProfile();
        setProfile(res.data);
        setFullName(res.data.fullName);
        setPhoneNumber(res.data.phoneNumber);

        // Fetch bookings count
        const bookingsRes = await bookingApi.getMyBookings();
        setBookingCount(bookingsRes.data?.length || 0);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load user profile.');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await userApi.updateProfile({ fullName, phoneNumber });
      setProfile(res.data.user);
      authUtil.setUser(res.data.user);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile.';
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <p style={{ color: '#64748b' }}>Loading profile information...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '800px' }} className="animate-fade-in">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          User Profile & Membership
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: '4px' }}>
          Manage your passenger credentials and frequent flyer account
        </p>
      </div>

      {successMsg && (
        <div style={{ padding: '14px 18px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', color: '#065f46', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '14px 18px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} color="#dc2626" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Profile Overview Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '28px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          flexWrap: 'wrap'
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)'
          }}
        >
          {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{profile?.fullName}</h2>
            <span className="badge badge-active">Active Traveler</span>
            <span className="badge badge-used" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Award size={12} /> Silver Tier
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>{profile?.email}</p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0284c7' }}>{bookingCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Flights</div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '28px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
        }}
      >
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '20px' }}>
          Account Credentials
        </h3>

        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Full Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 42px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Email (Readonly) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Email Address (Account ID)
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 42px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  fontSize: '0.92rem',
                  cursor: 'not-allowed'
                }}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Phone Number
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 42px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.92rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Member Since */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.82rem', marginTop: '6px' }}>
            <Calendar size={16} />
            <span>Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</span>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Save size={18} />
              <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
