import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlaneTakeoff,
  Ticket,
  CalendarCheck,
  Tag,
  User,
  LogOut,
  Plane
} from 'lucide-react';
import { authUtil } from '../utils/auth';

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    authUtil.clearSession();
    navigate('/login');
  };

  const dashboardPath = authUtil.isAdmin() ? '/admin-dashboard' : '/user-dashboard';
  const navItems = [
    { name: 'Dashboard', path: dashboardPath, icon: LayoutDashboard },
    { name: 'Flight Availability', path: '/availability', icon: PlaneTakeoff },
    { name: 'available Creation', path: '/availableCreation', icon: Ticket },
    { name: 'My Bookings', path: '/my-bookings', icon: CalendarCheck },
    { name: 'Coupons', path: '/coupons', icon: Tag },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            zIndex: 40,
            backdropFilter: 'blur(4px)'
          }}
        />
      )}

      <aside
        style={{
          width: '260px',
          height: '100vh',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px 16px',
          transform: isOpen ? 'translateX(0)' : undefined,
          transition: 'transform 0.3s ease-in-out',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)'
        }}
        className="sidebar-container"
      >
        <div>
          {/* Brand Logo Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px 28px',
              borderBottom: '1px solid #1e293b'
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
              }}
            >
              <Plane size={24} color="#ffffff" style={{ transform: 'rotate(-45deg)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
                AeroWings
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Booking Portal
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? '#0284c7' : 'transparent',
                    boxShadow: isActive ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
                    transition: 'all 0.2s ease'
                  })}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.backgroundColor = '#1e293b';
                      e.currentTarget.style.color = '#f1f5f9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#94a3b8';
                    }
                  }}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Logout */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '0.92rem',
              fontWeight: 500,
              color: '#f87171',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
            }}
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
