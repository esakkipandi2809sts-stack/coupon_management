import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  Printer,
  LayoutDashboard,
  Plane,
  QrCode
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatINR } from '../utils/flightPricing';

export default function BookingConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();

  const booking = location.state?.booking;
  const couponPageData = location.state?.couponPageData;
  const couponRefreshError = location.state?.couponRefreshError;

  useEffect(() => {
    // Launch celebratory confetti effect on mount
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Ignore if canvas-confetti is not loaded
    }
  }, []);

  if (!booking) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <Plane size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>No Booking Selected</h2>
        <p style={{ color: '#64748b', marginTop: '6px' }}>Please select a booking from My Bookings or complete a new reservation.</p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ marginTop: '16px', padding: '10px 20px', borderRadius: '10px', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 600 }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }} className="animate-fade-in">
      {/* Top Success Badge */}
      <div style={{ textAlign: 'center', maxWidth: '600px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)'
          }}
        >
          <CheckCircle2 size={36} />
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Booking Confirmed!
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '6px' }}>
          {booking.message || 'Your flight ticket has been issued successfully.'} A confirmation email has been sent to{' '}
          <strong style={{ color: '#0f172a' }}>{booking.passengerEmail}</strong>.
        </p>
      </div>

      {couponPageData && (
        <div style={{ width: '100%', maxWidth: '780px', padding: '18px 22px', borderRadius: '16px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>Coupons updated</div>
              <div style={{ marginTop: '4px', color: '#475569', fontSize: '0.9rem' }}>
                Total Coupons: <strong>{couponPageData.statistics.totalCoupons}</strong>
                {' · '}
                Pending Coupons: <strong>{couponPageData.statistics.pendingCoupons}</strong>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/coupons')}
              style={{ padding: '10px 16px', borderRadius: '10px', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: 700 }}
            >
              View Coupon Details
            </button>
          </div>
        </div>
      )}
      {couponRefreshError && (
        <p role="alert" style={{ width: '100%', maxWidth: '780px', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
          {couponRefreshError}
        </p>
      )}

      {/* Digital Flight Ticket / Boarding Pass */}
      <div
        className="ticket-container print-area"
        style={{
          width: '100%',
          maxWidth: '780px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Boarding Pass Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plane size={24} style={{ transform: 'rotate(-45deg)' }} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{booking.airline}</div>
              <div style={{ fontSize: '0.8rem', color: '#e0f2fe' }}>Official E-Boarding Ticket</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#bae6fd', letterSpacing: '0.08em' }}>
              Booking Reference
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
              {booking.bookingReference}
            </div>
          </div>
        </div>

        {/* Route & Times Visual */}
        <div style={{ padding: '32px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: '24px',
              paddingBottom: '28px',
              borderBottom: '1px dashed #cbd5e1'
            }}
          >
            {/* Origin */}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                Departure
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {booking.departureTime}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0284c7' }}>
                {booking.fromCity}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                {booking.departureDate}
              </div>
            </div>

            {/* Flight Path with Plane */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '140px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                {booking.duration}
              </span>
              <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ height: '2px', width: '100%', backgroundColor: '#cbd5e1' }} />
                <div style={{ position: 'absolute', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <Plane size={14} style={{ transform: 'rotate(45deg)' }} />
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: '6px' }}>
                Flight {booking.flightNumber}
              </span>
            </div>

            {/* Destination */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                Arrival
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                {booking.arrivalTime}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0284c7' }}>
                {booking.toCity}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                {booking.arrivalDate}
              </div>
            </div>
          </div>

          {/* Passenger & Ticket Details Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px',
              padding: '24px 0',
              borderBottom: '1px dashed #cbd5e1'
            }}
            className="ticket-meta-grid"
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Passenger</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>{booking.passengerName}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Age: {booking.passengerAge} • {booking.passengerGender}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Seat</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {booking.seatNumber}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cabin Seat</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Class</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>{booking.class}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{booking.passengerCount || 1} traveller(s)</div>
              <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Confirmed</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Status</div>
              <div style={{ marginTop: '4px' }}>
                <span className="badge badge-confirmed">{booking.bookingStatus}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '3px' }}>Payment: {booking.paymentStatus}</div>
            </div>
          </div>

          {/* Financial Breakdown & Barcode stub */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Base Fare</span>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>
                  {formatINR(booking.baseFare ?? booking.finalAmount ?? booking.ticketPrice)}
                </div>
              </div>

              {Number(booking.discountAmount || 0) > 0 && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#059669', textTransform: 'uppercase' }}>
                    Coupon Discount ({booking.appliedCouponCode || 'Coupon'})
                  </span>
                  <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>
                    -{formatINR(booking.discountAmount)}
                  </div>
                  {(booking.appliedCouponPercentage || booking.appliedCouponPoints) && (
                    <div style={{ fontSize: '0.75rem', color: '#059669' }}>
                      {booking.appliedCouponPercentage ? `${booking.appliedCouponPercentage}% ` : ''}
                      {booking.appliedCouponPoints ? `(${Math.round(booking.appliedCouponPoints)} pts)` : ''}
                    </div>
                  )}
                </div>
              )} 

              {booking.pointsDiscountAmount > 0 && !booking.discountAmount && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#059669', textTransform: 'uppercase' }}>
                    Points Redeemed ({Math.round(Number(booking.pointsRedeemed || 0))} pts)
                  </span>
                  <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>-{formatINR(booking.pointsDiscountAmount)}</div>
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Taxes & Fees</span>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{formatINR(booking.taxes ?? 0)}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>Final Fare</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0284c7' }}>
                  {formatINR(booking.finalAmount ?? booking.finalFare ?? booking.ticketPrice)}
                </div>
                {booking.generatedCouponCode && (
                  <div style={{ marginTop: '18px', padding: '14px 16px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                    <div style={{ fontWeight: 700, color: '#92400e' }}>
                      Earned {booking.generatedCouponPercentage ? `${booking.generatedCouponPercentage}% ` : ''}Reward Coupon: {booking.generatedCouponCode}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#78350f', marginTop: '4px' }}>
                      Coupon Points: <strong>{Math.round(booking.generatedCouponPoints || booking.couponPointsEarned || 0)} pts</strong>
                      {booking.generatedCouponPercentage ? ` (${booking.generatedCouponPercentage}%)` : ''} · Discount: <strong>{formatINR(booking.generatedCouponAmount || 0)}</strong> · Final Fare: <strong>{formatINR(booking.finalAmount ?? booking.ticketPrice)}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '4px' }}>
                      Status: {booking.generatedCouponStatus}. Available on your flight departure date ({booking.generatedCouponAvailableFromDate || 'shown in your bookings'}).
                    </div>
                  </div>
                )}
                {booking.couponPointsEarned > 0 && !booking.generatedCouponCode && (
                  <div style={{ marginTop: '10px', color: '#0369a1', fontSize: '0.82rem', fontWeight: 700 }}>
                    Earned {Math.round(booking.couponPointsEarned)} coupon points from this booking.
                  </div>
                )}
              </div>
            </div>

            {/* QR Code and Barcode styling */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#f8fafc', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={36} color="#0f172a" />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  AEROWINGS BOARDING SCAN
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                  {booking.bookingReference}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }} className="no-print">
        <button
          onClick={handlePrint}
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
          <Printer size={18} />
          <span>Print Ticket</span>
        </button>

        <button
          onClick={handleDownload}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            fontWeight: 700,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Download size={18} />
          <span>Download PDF / Print</span>
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#f1f5f9',
            color: '#475569',
            fontWeight: 700,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <LayoutDashboard size={18} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
        @media (max-width: 650px) {
          .ticket-meta-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
