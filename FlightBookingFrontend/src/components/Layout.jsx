import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Desktop & Mobile Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginLeft: '260px',
          transition: 'margin-left 0.3s ease'
        }}
        className="main-layout-content"
      >
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main style={{ flex: 1, padding: '28px 32px' }} className="page-main-container">
          <Outlet />
        </main>

        <footer
          style={{
            padding: '20px 32px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: '#64748b'
          }}
        >
          <div>
            © {new Date().getFullYear()} AeroWings Ticket Booking & Coupon Management System. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Powered by ASP.NET Core & SQL Server</span>
          </div>
        </footer>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .main-layout-content {
            margin-left: 0 !important;
          }
          .sidebar-container {
            transform: translateX(-100%);
          }
          .page-main-container {
            padding: 20px 16px !important;
          }
        }
        @media (min-width: 1025px) {
          .mobile-menu-btn {
            display: none !important;
          }
          .user-text-pill {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
