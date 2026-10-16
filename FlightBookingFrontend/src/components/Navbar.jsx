import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, User, LogOut } from 'lucide-react';
import { authUtil } from '../utils/auth';

export default function Navbar({ onToggleSidebar, onSearch }) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const currentUser = authUtil.getUser() || { fullName: 'Traveler', email: 'user@example.com' };

  const handleLogout = () => {
    authUtil.clearSession();
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchValue);
    } else if (searchValue.trim()) {
      navigate(`/availability?search=${encodeURIComponent(searchValue)}`);
    }
  };

  const notifications = [
    { id: 2, title: 'Booking Confirmed', desc: 'Check your upcoming tickets in My Bookings', time: '1h ago' },
  ];

  return (
    <header
      style={{
        height: '70px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}
    >
      {/* Left: Mobile Toggle & Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, maxWidth: '480px' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            borderRadius: '8px',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="mobile-menu-btn"
        >
          <Menu size={22} />
        </button>

        <form onSubmit={handleSearchSubmit} style={{ width: '100%', position: 'relative' }}>
          <Search
            size={18}
            color="#94a3b8"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search flights, routes, or destinations..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 16px 9px 40px',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              fontSize: '0.88rem',
              color: '#0f172a',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0284c7';
              e.target.style.backgroundColor = '#ffffff';
              e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.backgroundColor = '#f8fafc';
              e.target.style.boxShadow = 'none';
            }}
          />
        </form>
      </div>

      {/* Right: Notifications & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Notifications Popover */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            style={{
              position: 'relative',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
          >
            <Bell size={19} />
            <span
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                border: '2px solid #ffffff'
              }}
            />
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '50px',
                width: '320px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                border: '1px solid #e2e8f0',
                padding: '16px',
                zIndex: 50,
                animation: 'fadeIn 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Notifications</span>
                <span style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600 }}>3 New</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>{n.title}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{n.time}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>{n.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px 6px 6px',
              borderRadius: '9999px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ textAlign: 'left', display: 'none' }} className="user-text-pill">
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>
                {currentUser.fullName || 'User'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {currentUser.email || ''}
              </div>
            </div>
          </button>

          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '50px',
                width: '220px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                border: '1px solid #e2e8f0',
                padding: '12px',
                zIndex: 50,
                animation: 'fadeIn 0.2s ease'
              }}
            >
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', marginBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{currentUser.fullName}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.email}</div>
              </div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate('/profile');
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: '#334155',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <User size={16} />
                <span>My Profile</span>
              </button>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: '#dc2626',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  marginTop: '4px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
