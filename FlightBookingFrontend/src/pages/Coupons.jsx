import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  RefreshCw,
  Grid,
  List,
  TrendingUp,
  Coins,
  BadgePercent,
} from 'lucide-react';
import { couponApi } from '../services/api';
import CouponCard from '../components/CouponCard';
import { formatINR } from '../utils/flightPricing';
import { authUtil } from '../utils/auth';

export default function Coupons() {
  const isAdmin = authUtil.isAdmin();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState({
    availableCoupons: 0,
    pendingCoupons: 0,
    usedCoupons: 0,
    expiredCoupons: 0,
    totalCoupons: 0,
  });
  const [balance, setBalance] = useState({
    availablePoints: 0,
    pendingPoints: 0,
    redeemedPoints: 0,
    totalPoints: 0,
    availableDiscountAmount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchCouponsData = useCallback(async () => {
    setLoading(true);
    setCoupons([]);
    setError('');
    try {
      const requests = [
        isAdmin ? couponApi.getAllForAdmin() : couponApi.getAll(),
        isAdmin ? couponApi.getAdminStatistics() : couponApi.getStatistics(),
      ];
      if (!isAdmin) requests.push(couponApi.getBalance());

      const [couponsRes, statsRes, balanceRes] = await Promise.all(requests);
      setStats(statsRes.data);
      setCoupons(couponsRes.data);
      if (balanceRes) setBalance(balanceRes.data);
    } catch (err) {
      console.error('Failed to load coupons:', err);
      setError(err.response?.data?.message || 'Failed to load coupon data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchCouponsData();
  }, [fetchCouponsData]);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleApplyCoupon = (code) => {
    navigate('/availability', { state: { couponCode: code } });
  };

  // Filter coupons by tab and search
  const filteredCoupons = coupons.filter((c) => {
    if (c.bookingStatus === 'Cancelled') return false;
    if (activeTab === 'available' && c.status.toLowerCase() !== 'available') return false;
    if (activeTab === 'pending' && c.status.toLowerCase() !== 'pending') return false;
    if (activeTab === 'used' && c.status.toLowerCase() !== 'used') return false;
    if (activeTab === 'expired' && c.status.toLowerCase() !== 'expired') return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        c.couponCode.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        (c.bookingReference || '').toLowerCase().includes(term) ||
        (c.ownerUsername || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {isAdmin ? 'Coupon Administration' : 'Flight Discount Coupons & Vouchers'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: '4px' }}>
            {isAdmin
              ? 'Review generated coupons and their current passenger, value, and status. Coupon records are read-only.'
              : 'Coupons earned from your confirmed flight bookings'}
          </p>
        </div>

        <button
          onClick={fetchCouponsData}
          style={{
            padding: '10px 16px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            fontWeight: 600
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Coupons</span>
        </button>
      </div>

      {/* Points Balance Banner — visible to regular users only */}
      {!isAdmin && (
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0284c7 100%)',
          borderRadius: '20px',
          padding: '24px 28px',
          color: '#ffffff',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 32px rgba(2,132,199,0.25)',
        }}>
          {/* Left — available points hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}>
              <TrendingUp size={28} color="#7dd3fc" />
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#bae6fd', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Available Points
              </p>
              <p style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.1 }}>
                {loading ? '…' : Math.round(balance.availablePoints).toLocaleString()}
              </p>
              <p style={{ fontSize: '0.82rem', color: '#7dd3fc', margin: 0 }}>
                ≈ ₹{loading ? '…' : Number(balance.availableDiscountAmount).toFixed(2)} Cash Equivalent
              </p>
            </div>
          </div>

          {/* Right — mini stats */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.72rem', color: '#bae6fd', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>Total Earned</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                {loading ? '—' : Math.round(balance.totalPoints).toLocaleString()}
              </p>
            </div>
            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.72rem', color: '#bae6fd', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>Pending</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', margin: 0 }}>
                {loading ? '—' : Math.round(balance.pendingPoints).toLocaleString()}
              </p>
            </div>
            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.72rem', color: '#bae6fd', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 4px' }}>Redeemed</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', margin: 0 }}>
                {loading ? '—' : Math.round(balance.redeemedPoints).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Coupon summary is calculated from the passenger's SQL Server records */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div
          onClick={() => setActiveTab('available')}
          style={{
            padding: '18px',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            border: activeTab === 'available' ? '2px solid #0284c7' : '1px solid #e2e8f0',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Available Coupons</span>
            <Tag size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0284c7', marginTop: '8px' }}>
            {stats.availableCoupons}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '18px',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            border: activeTab === 'pending' ? '2px solid #d97706' : '1px solid #e2e8f0',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Pending Coupons</span>
            <Clock size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', marginTop: '8px' }}>
            {stats.pendingCoupons}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('used')}
          style={{
            padding: '18px',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            border: activeTab === 'used' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Used Coupons</span>
            <CheckCircle2 size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', marginTop: '8px' }}>
            {stats.usedCoupons}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('expired')}
          style={{
            padding: '18px',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            border: activeTab === 'expired' ? '2px solid #64748b' : '1px solid #e2e8f0',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Expired Coupons</span>
            <AlertCircle size={18} color="#64748b" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#64748b', marginTop: '8px' }}>
            {stats.expiredCoupons}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('all')}
          style={{
            padding: '18px',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            border: activeTab === 'all' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Total Coupons</span>
            <Layers size={18} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7c3aed', marginTop: '8px' }}>
            {stats.totalCoupons}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} color="#0284c7" className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b' }}>Loading your coupons...</p>
        </div>
      )}

      {!loading && !error && (
        <>

          {/* Control bar: Search, Filter Tabs, and View Toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>

            {/* Tab filters & View switcher */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                {['all', 'available', 'pending', 'used', 'expired'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
                      color: activeTab === tab ? '#0284c7' : '#64748b',
                      boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    padding: '7px 10px',
                    backgroundColor: viewMode === 'grid' ? '#0284c7' : '#ffffff',
                    color: viewMode === 'grid' ? '#ffffff' : '#64748b'
                  }}
                  title="Grid Cards"
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  style={{
                    padding: '7px 10px',
                    backgroundColor: viewMode === 'table' ? '#0284c7' : '#ffffff',
                    color: viewMode === 'table' ? '#ffffff' : '#64748b'
                  }}
                  title="Table View"
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Content: Cards or Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <RefreshCw size={36} color="#0284c7" className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#64748b' }}>Loading coupon database from SQL Server...</p>
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <Tag size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>No Coupons Found</h3>
              <p style={{ color: '#64748b', marginTop: '6px' }}>Try switching tabs or adjusting search query.</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid Cards View */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', color: 'red' }}>
              {filteredCoupons.map((c) => (
                <CouponCard
                  key={c.couponId}
                  coupon={c}
                  onApply={isAdmin ? undefined : handleApplyCoupon}
                />
              ))}
            </div>
          ) : (
            /* Table View */
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', whiteSpace: 'nowrap', }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Coupon Code</th>
                      {isAdmin && <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Passenger</th>}
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Points & %</th>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Discount</th>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Fare / Final</th>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Booking Reference</th>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Generated Date</th>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Expiry Date</th>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Usage</th>
                      <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Status</th>
                      {/* <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Action</th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoupons.map((c) => (
                      <tr key={c.couponId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                          {c.couponCode}
                        </td>
                        {isAdmin && (
                          <td style={{ padding: '14px 18px', color: '#334155' }}>
                            {c.ownerUsername || `User #${c.userId ?? 'unknown'}`}
                          </td>
                        )}
                        <td style={{ padding: '14px 18px', color: '#0284c7', fontWeight: 700 }}>
                          {Number(c.couponPoints) > 0 ? `${Math.round(c.couponPoints)} pts` : '—'}
                          {Number(c.discountPercentage) > 0 && ` (${Math.round(c.discountPercentage)}%)`}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: '#059669' }}>
                          {formatINR(c.discountAmount ?? c.discountValue)}
                        </td>
                        <td style={{ padding: '14px 18px', color: '#334155' }}>
                          {c.originalFlightFare > 0 ? (
                            <span>
                              {formatINR(c.originalFlightFare)}
                              <span style={{ color: '#64748b', fontSize: '0.8rem' }}> → </span>
                              <strong style={{ color: '#0284c7' }}>
                                {formatINR(Math.max(0, Math.round(c.originalFlightFare - Number(c.discountAmount ?? c.discountValue))))}
                              </strong>
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '14px 18px', color: '#0284c7', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {c.bookingReference || '—'}
                        </td>
                        <td style={{ padding: '14px 18px', color: '#64748b' }}>
                          {new Date(c.expiryDate).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 18px', color: '#475569' }}>
                          {c.usedCount} / {c.totalUsageLimit}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span className={`badge ${c.status === 'Available' ? 'badge-available' :
                            c.status === 'Pending' ? 'badge-pending' :
                              c.status === 'Used' ? 'badge-used' : 'badge-expired'
                            }`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleCopy(c.couponCode)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              backgroundColor: copiedCode === c.couponCode ? '#ecfdf5' : '#f8fafc',
                              color: copiedCode === c.couponCode ? '#059669' : '#334155',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}
                          >
                            {copiedCode === c.couponCode ? 'Copied' : 'Copy'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
