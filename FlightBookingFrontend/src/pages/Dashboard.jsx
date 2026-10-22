import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tag,
  Clock,
  XCircle,
  AlertCircle,
  PlaneTakeoff,
  CalendarCheck,
  ArrowUpRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
// import { couponApi, dashboardApi } from '../services/api';
import { couponApi, dashboardApi, bookingApi } from '../services/api';
import { authUtil } from '../utils/auth';
import { formatINR } from '../utils/flightPricing';

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = authUtil.getUser();
  const isAdmin = authUtil.isAdmin();

  const [loading, setLoading] = useState(true);
  const [couponStats, setCouponStats] = useState({
    availableCoupons: 0,
    pendingCoupons: 0,
    usedCoupons: 0,
    totalCoupons: 0,
  });

  const [dashboardStats, setDashboardStats] = useState({
    totalBookings: 0,
    confirmedBookings: 0,
    availableFlights: 0,
    totalRevenue: 0,
  });

  const [bookingStats, setBookingStats] = useState({
    totalBookings: 0,
    cancelledBookings: 0,
    rescheduledBookings: 0,
    failedBookings: 0,
  });
  const [bookingStatsLoading, setBookingStatsLoading] = useState(true);
  const [bookingStatsLoaded, setBookingStatsLoaded] = useState(false);
  const [bookingStatsError, setBookingStatsError] = useState('');

  const [recentBookings, setRecentBookings] = useState([]);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [availableCouponsLoading, setAvailableCouponsLoading] = useState(true);
  const [availableCouponsError, setAvailableCouponsError] = useState('');
  const [error, setError] = useState('');

  const fetchBookingStats = useCallback(async () => {
    setBookingStatsLoading(true);
    setBookingStatsError('');
    try {
      const res = await dashboardApi.getBookingStatistics();
      setBookingStats({
        totalBookings: res.data.totalBookings ?? 0,
        cancelledBookings: res.data.cancelledBookings ?? 0,
        rescheduledBookings: res.data.rescheduledBookings ?? 0,
        failedBookings: res.data.failedBookings ?? 0,
      });
      setBookingStatsLoaded(true);
    } catch (err) {
      console.error('Failed to load booking statistics:', err);
      setBookingStatsError(
        err.response?.data?.message || 'Unable to load booking details. Please try again.'
      );
    } finally {
      setBookingStatsLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    fetchBookingStats();
    try {
      // 1. Fetch Coupon Statistics from API (as explicitly requested: GET /api/coupons/statistics)
      const couponRes = await couponApi.getStatistics();
      setCouponStats(couponRes.data);

      // Coupon list is scoped to the authenticated passenger by the backend.
      try {
        const passengerCouponsRes = await couponApi.getAll();
        setAvailableCoupons(
          passengerCouponsRes.data.filter(
            (coupon) => coupon.status?.toLowerCase() === 'available'
          )
        );
        setAvailableCouponsError('');
      } catch (couponErr) {
        console.error('Failed to load passenger coupons:', couponErr);
        setAvailableCouponsError('Unable to load your available coupons.');
      }

      // 2. Fetch General Dashboard Statistics
      const dashRes = await dashboardApi.getStatistics();
      setDashboardStats(dashRes.data);

      // 3. Fetch only the logged-in user's bookings
      const recentRes = await bookingApi.getMyBookings();

      const userBookings = Array.isArray(recentRes.data)
        ? recentRes.data
        : [];

      const sortedBookings = [...userBookings].sort(
        (a, b) =>
          new Date(b.bookingDate).getTime() -
          new Date(a.bookingDate).getTime()
      );

      setRecentBookings(sortedBookings.slice(0, 5));



    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to fetch live statistics from server. Please ensure the backend is running.');
    } finally {
      setLoading(false);
      setAvailableCouponsLoading(false);
    }
  }, [fetchBookingStats]);

  useEffect(() => {
    fetchDashboardData();
    const refreshInterval = window.setInterval(fetchDashboardData, 30000);
    const refreshOnFocus = () => fetchDashboardData();
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [fetchDashboardData]);

  const totalCoupons =
    couponStats.availableCoupons +
    couponStats.pendingCoupons +
    couponStats.usedCoupons;

  // Booking Details cards (counts come from the Bookings table via /api/dashboard/booking-statistics)
  const bookingCards = [
    {
      id: 'total',
      label: 'Total Bookings',
      count: bookingStats.totalBookings,
      description: 'All booking records',
      icon: CalendarCheck,
      color: '#0284c7',
      bg: '#e0f2fe',
      filter: 'All'
    },
    {
      id: 'cancelled',
      label: 'Cancelled Bookings',
      count: bookingStats.cancelledBookings,
      description: 'Bookings with Cancelled status',
      icon: XCircle,
      color: '#dc2626',
      bg: '#fef2f2',
      filter: 'Cancelled'
    },
    {
      id: 'rescheduled',
      label: 'Rescheduled Bookings',
      count: bookingStats.rescheduledBookings,
      description: 'Moved to a different flight',
      icon: Clock,
      color: '#7c3aed',
      bg: '#f3e8ff',
      filter: 'Rescheduled'
    },
    {
      id: 'failed',
      label: 'Booking Failed',
      count: bookingStats.failedBookings,
      description: 'Attempts that could not be completed',
      icon: AlertCircle,
      color: '#d97706',
      bg: '#fef3c7',
      filter: 'Failed'
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #0f172a 100%)',
          borderRadius: '20px',
          padding: '32px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ maxWidth: '600px', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px' }}>
            <Sparkles size={14} color="#fde047" />
            <span>{isAdmin ? 'Administrator Console' : 'Real-time System Overview'}</span>
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Welcome back , {currentUser?.fullName || 'Traveler'} !
          </h1>
          <p style={{ color: '#e0f2fe', marginTop: '8px', fontSize: '0.95rem' }}>
            {isAdmin
              ? 'Manage scheduled flights and review the booking system.'
              : 'Explore active flights, apply exclusive airline promo codes, and manage your booked journeys seamlessly.'}
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Booking Details */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Booking Details</h2>

          </div>
          {!isAdmin && (
            <button              
              style={{ background: 'none', color: '#0284c7', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>View My Bookings</span>
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>

        {bookingStatsError && (
          <div
            role="alert"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '14px 16px', marginBottom: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#b91c1c', fontSize: '0.88rem' }}
          >
            <span>{bookingStatsError}</span>
            <button
              onClick={fetchBookingStats}
              style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid #fecaca', color: '#b91c1c', fontWeight: 600, fontSize: '0.82rem' }}
            >
              Retry
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {bookingCards.map((card) => {
            const Icon = card.icon;
            const clickable = !isAdmin;
            return (
              <div
                key={card.id}
                data-testid={`booking-card-${card.id}`}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '18px',
                  border: '1px solid #e2e8f0',
                  padding: '24px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'all 0.25s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 25px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = card.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      backgroundColor: card.bg,
                      color: card.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon size={24} />
                  </div>
                </div>

                <div style={{ marginTop: '18px' }}>
                  <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {bookingStatsError ? '—' : bookingStatsLoading && !bookingStatsLoaded ? '...' : card.count}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginTop: '6px' }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                    {card.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Secondary Metrics & Visual Breakdown */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Booking Statistics Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Booking Statistics</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Bookings</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {bookingStatsError ? '—' : bookingStatsLoading && !bookingStatsLoaded ? '...' : bookingStats.totalBookings}
              </div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Active Flights</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                {dashboardStats.availableFlights}
              </div>
            </div>
          </div>

          {/* Graphical Representation: Coupon Distribution Bar */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, color: '#334155' }}>Coupon Utilization Ratio</span>
              <span style={{ color: '#64748b' }}>
                {totalCoupons > 0
                  ? Math.round((couponStats.usedCoupons / totalCoupons) * 100)
                  : 0}% Redeemed
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', display: 'flex' }}>
              <div
                style={{
                  width: `${totalCoupons > 0 ? (couponStats.availableCoupons / totalCoupons) * 100 : 0}%`,
                  backgroundColor: '#0284c7'
                }}
                title="Available"
              />
              <div
                style={{
                  width: `${totalCoupons > 0 ? (couponStats.usedCoupons / totalCoupons) * 100 : 0}%`,
                  backgroundColor: '#10b981'
                }}
                title="Used"
              />
              <div
                style={{
                  width: `${totalCoupons > 0 ? (couponStats.pendingCoupons / totalCoupons) * 100 : 0}%`,
                  backgroundColor: '#f59e0b'
                }}
                title="Pending"
              />
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem', color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7' }} /> Available
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Used
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Pending
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
              Quick Actions
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '20px' }}>
              Frequent workflows and rapid navigation
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => navigate('/availability')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <PlaneTakeoff size={18} color="#0284c7" />
                  <span>Search & Book Flights</span>
                </div>
                <ArrowUpRight size={16} color="#94a3b8" />
              </button>

              <button
                onClick={() => navigate('/coupons')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Tag size={18} color="#059669" />
                  <span>Explore Flight Discount Coupons</span>
                </div>
                <ArrowUpRight size={16} color="#94a3b8" />
              </button>

              <button
                onClick={() => navigate('/my-bookings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CalendarCheck size={18} color="#7c3aed" />
                  <span>My Booking Tickets</span>
                </div>
                <ArrowUpRight size={16} color="#94a3b8" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Bookings and route-based flight search */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Recent Bookings List */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Recent Bookings</h3>
            <button
              onClick={() => navigate('/my-bookings')}
              style={{ background: 'none', color: '#0284c7', fontSize: '0.82rem', fontWeight: 600 }}
            >
              View All
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '24px 0' }}>
              No recent bookings found.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentBookings.map((b) => (
                <div
                  key={b.bookingId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #f1f5f9'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                        {b.bookingReference}
                      </span>
                      <span className="badge badge-confirmed" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                        {b.bookingStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      {b.passengerName} • {b.route}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                      {formatINR(b.amount)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {new Date(b.bookingDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
