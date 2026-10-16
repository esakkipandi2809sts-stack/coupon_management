import React, { useState } from 'react';
import { Tag, Copy, Check } from 'lucide-react';
import { formatINR } from '../utils/flightPricing';

export default function CouponCard({ coupon, onApply }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usagePercentage = Math.min(100, Math.round((coupon.usedCount / coupon.totalUsageLimit) * 100));
  const couponDiscountAmount = Number(coupon.discountAmount ?? coupon.discountValue);

  const getStatusBadge = () => {
    const status = coupon.status.toLowerCase();
    if (status === 'available') {
      return <span className="badge badge-available">Available</span>;
    } else if (status === 'pending') {
      return <span className="badge badge-pending">Pending</span>;
    } else if (status === 'used') {
      return <span className="badge badge-used">Used</span>;
    } else {
      return <span className="badge badge-expired">{coupon.status}</span>;
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}
      className="coupon-card"
    >
      {/* Top Tag & Status */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f0f9ff',
              color: '#0284c7',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              border: '1px dashed #0284c7'
            }}
          >
            <Tag size={15} />
            <span style={{color: '#0284c7',}}>{coupon.couponCode}</span>
          </div>
          {getStatusBadge()}
        </div>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
          {formatINR(couponDiscountAmount)} OFF
        </h4>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0284c7', marginBottom: '8px' }}>
          {Number(coupon.couponPoints) > 0 ? `${Math.round(coupon.couponPoints)} Points` : ''}
          {Number(coupon.discountPercentage) > 0 ? ` · ${Math.round(coupon.discountPercentage)}%` : ''}
        </div>
        {coupon.originalFlightFare > 0 && (
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '6px' }}>
            <span>Fare: {formatINR(coupon.originalFlightFare)}</span>
            {' → '}
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              Final: {formatINR(Math.max(0, Math.round(coupon.originalFlightFare - couponDiscountAmount)))}
            </span>
          </div>
        )}
        {coupon.ownerUsername && (
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px' }}>
            Passenger: {coupon.ownerUsername}
          </p>
        )}
      </div>

      {/* Middle Specs */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
          <span>Generated:</span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>
            {new Date(coupon.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
          <span>Valid Until:</span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>
            {new Date(coupon.expiryDate).toLocaleDateString()}
          </span>
        </div>
        {coupon.journeyDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
            <span>Flight Date:</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{coupon.journeyDate}</span>
          </div>
        )}
        
        {coupon.availableFromDate && coupon.status.toLowerCase() === 'pending' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '10px' }}>
            <span>Available From:</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{coupon.availableFromDate}</span>
          </div>
        )}

        {/* Usage Progress Bar */}
        <div style={{ width: '100%', backgroundColor: '#f1f5f9', height: '6px', borderRadius: '9999px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${usagePercentage}%`,
              backgroundColor: usagePercentage > 80 ? '#f59e0b' : '#0284c7',
              height: '100%',
              borderRadius: '9999px',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
          <span>Usage: {coupon.usedCount} of {coupon.totalUsageLimit}</span>
          <span>{usagePercentage}% used</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: copied ? '#ecfdf5' : '#f8fafc',
            color: copied ? '#059669' : '#334155',
            border: `1px solid ${copied ? '#a7f3d0' : '#e2e8f0'}`,
            padding: '9px 12px',
            borderRadius: '10px',
            fontSize: '0.82rem',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy Code'}</span>
        </button>

        {onApply && coupon.status === 'Available' && (
          <button
            onClick={() => onApply(coupon.couponCode)}
            style={{
              padding: '9px 14px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}


