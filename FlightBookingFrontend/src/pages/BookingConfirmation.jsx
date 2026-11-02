import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Download,
  Printer,
  LayoutDashboard,
  Plane,
  QrCode,
  Star,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatINR } from '../utils/flightPricing';
import { bookingApi } from '../services/api';

const formatCancelDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export default function BookingConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialBooking = location.state?.booking;
  const couponPageData = location.state?.couponPageData;
  const couponRefreshError = location.state?.couponRefreshError;

  const [currentBooking, setCurrentBooking] = useState(initialBooking);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState('');
  const [cancelError, setCancelError] = useState('');

  const booking = currentBooking;

  const allPassengers = React.useMemo(() => {
    if (Array.isArray(booking?.passengers) && booking.passengers.length > 0) {
      return booking.passengers;
    }
    if (typeof booking?.passengerDetails === 'string' && booking.passengerDetails.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(booking.passengerDetails);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [{
      name: booking?.passengerName || '',
      email: booking?.passengerEmail || '',
      phone: booking?.passengerPhone || '',
      age: booking?.passengerAge,
      gender: booking?.passengerGender,
      seat: booking?.seatNumber || ''
    }];
  }, [booking]);

  useEffect(() => {
    // Launch celebratory confetti effect on mount if booking is confirmed
    if (booking?.bookingStatus?.toLowerCase() !== 'cancelled') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Ignore if canvas-confetti is not loaded
      }
    }
  }, []);

  const handleCancelTicket = async () => {
    if (!booking?.bookingId) return;

    const confirmed = window.confirm(
      'Are you sure you want to cancel this flight ticket? This will update the booking status to Cancelled in the database.'
    );
    if (!confirmed) return;

    setCancelling(true);
    setCancelError('');
    setCancelMessage('');

    try {
      const res = await bookingApi.cancel(booking.bookingId);
      setCancelMessage(res.data?.message || 'Ticket cancelled successfully.');
      setCurrentBooking(prev => ({
        ...prev,
        bookingStatus: 'Cancelled',
        paymentStatus: 'Refunded',
        cancelDate: new Date().toISOString()
      }));
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel ticket.');
    } finally {
      setCancelling(false);
    }
  };

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
            backgroundColor: booking.bookingStatus?.toLowerCase() === 'cancelled' ? '#fef2f2' : '#ecfdf5',
            color: booking.bookingStatus?.toLowerCase() === 'cancelled' ? '#dc2626' : '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: booking.bookingStatus?.toLowerCase() === 'cancelled' ? '0 8px 20px rgba(220, 38, 38, 0.2)' : '0 8px 20px rgba(16, 185, 129, 0.2)'
          }}
        >
          {booking.bookingStatus?.toLowerCase() === 'cancelled' ? <XCircle size={36} /> : <CheckCircle2 size={36} />}
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: booking.bookingStatus?.toLowerCase() === 'cancelled' ? '#dc2626' : '#0f172a', letterSpacing: '-0.02em' }}>
          {booking.bookingStatus?.toLowerCase() === 'cancelled' ? 'Booking Cancelled' : 'Booking Confirmed!'}
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '6px' }}>
          {booking.bookingStatus?.toLowerCase() === 'cancelled'
            ? `This booking was cancelled${(booking.cancelDate || booking.cancelledDate) ? ` on ${formatCancelDate(booking.cancelDate ?? booking.cancelledDate)}` : ''}. Any eligible refund has been processed.`
            : (booking.message || 'Your flight ticket has been issued successfully.') + ` A confirmation email has been sent to ${booking.passengerEmail}.`}
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
              Booking ID
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
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '15px' }}>
                {booking.duration}
              </span>
              <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ height: '2px', width: '100%', backgroundColor: '#cbd5e1' }} />
                <div style={{ position: 'absolute', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <Plane size={14} style={{ transform: 'rotate(45deg)' }} />
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, marginTop: '15px' }}>
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
              <div style={{ fontSize: '0.75rem', color: '#64748b', }}>
                Age : {booking.passengerAge} • {booking.passengerGender}
                
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', }}>
                
                {(booking.passengerDob || booking.dateOfBirth) ? ` DOB : ${booking.passengerDob || booking.dateOfBirth}` : ''}
              </div>
             
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
                <span className={`badge ${booking.bookingStatus?.toLowerCase() === 'cancelled' ? 'badge-cancelled' : 'badge-confirmed'}`}>{booking.bookingStatus}</span>
              </div>
              {booking.bookingStatus?.toLowerCase() === 'cancelled' && (booking.cancelDate || booking.cancelledDate || booking.cancellationDate) && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginTop: '3px' }}>
                  Cancelled: {formatCancelDate(booking.cancelDate ?? booking.cancelledDate ?? booking.cancellationDate)}
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: booking.bookingStatus?.toLowerCase() === 'cancelled' ? '#dc2626' : '#059669', marginTop: '3px' }}>Payment: {booking.paymentStatus}</div>
            </div>
          </div>

          {/* Detailed All Passengers List */}
          {allPassengers.length > 0 && (
            <div style={{ padding: '20px 0', borderBottom: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.04em' }}>
                All Passenger Details ({allPassengers.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {allPassengers.map((p, idx) => (
                  <div key={idx} style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                        {p.title ? `${p.title}. ` : ''}{p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim()}
                      </strong>
                      {p.seat && (
                        <span style={{ padding: '2px 8px', borderRadius: '6px', backgroundColor: '#0284c7', color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 700 }}>
                          {p.seat}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                      {p.age ? `Age: ${p.age}` : ''}{p.gender ? ` • ${p.gender}` : ''}{p.dob ? ` • DOB: ${p.dob}` : ''}
                    </div>
                    {p.email && (
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px', wordBreak: 'break-all' }}>
                        ✉ {p.email}
                      </div>
                    )}
                    {p.phone && (
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                        📞 {p.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Breakdown, Reward Coupon, QR Code, and Slogan matching Image 2 */}
          <div style={{ paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Row: Fare Pill Card + Reward Coupon Card */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'stretch' }}>
              {/* Fare Pill Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#f0f7ff',
                  border: '1.5px solid #dbeafe',
                  borderRadius: '16px',
                  padding: '15px',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.04)',
                  flexShrink: 0
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                    BASE FARE
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {formatINR(booking.baseFare ?? booking.finalAmount ?? booking.ticketPrice)}
                  </div>
                </div>

                <div style={{ width: '1px', height: '38px', backgroundColor: '#cbd5e1', margin: '0 20px' }} />

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                    FINAL FARE
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                    {formatINR(booking.finalAmount ?? booking.finalFare ?? booking.ticketPrice)}
                  </div>
                </div>

                {Number(booking.discountAmount || 0) > 0 && (
                  <>
                    <div style={{ width: '1px', height: '38px', backgroundColor: '#cbd5e1', margin: '0 16px' }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#059669', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                        DISCOUNT
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                        -{formatINR(booking.discountAmount)}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Reward Coupon Card */}
              {booking.generatedCouponCode ? (
                <div
                  style={{
                    flex: '1 1 320px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    backgroundColor: '#fffbeb',
                    border: '1.5px solid #fde68a',
                    borderRadius: '16px',
                    padding: '10px 15px',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.06)'
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.35)'
                    }}
                  >
                    <Star size={18} fill="#ffffff" stroke="#ffffff" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: '#78350f', fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
                      Earned {booking.generatedCouponPercentage ? `${booking.generatedCouponPercentage}% ` : ''}Reward Coupon: {booking.generatedCouponCode}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '2px', fontWeight: 500 }}>
                      Coupon Points: <strong>{Math.round(booking.generatedCouponPoints || booking.couponPointsEarned || 0)} pts</strong>
                      {booking.generatedCouponPercentage ? ` (${booking.generatedCouponPercentage}%)` : ''} · Discount: <strong>{formatINR(booking.generatedCouponAmount || 0)}</strong> · Final Fare: <strong>{formatINR(booking.finalAmount ?? booking.ticketPrice)}</strong>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#78350f', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={13} color="#4338ca" style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Status:</strong> {booking.generatedCouponStatus || 'Pending'}. Available on your flight departure date ({booking.generatedCouponAvailableFromDate || booking.departureDate || 'shown in your bookings'}).
                      </span>
                    </div>
                  </div>
                </div>
              ) : booking.couponPointsEarned > 0 ? (
                <div
                  style={{
                    flex: '1 1 320px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    backgroundColor: '#f0f9ff',
                    border: '1.5px solid #bae6fd',
                    borderRadius: '16px',
                    padding: '12px 18px'
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0
                    }}
                  >
                    <Star size={18} fill="#ffffff" stroke="#ffffff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem' }}>
                      Earned {Math.round(booking.couponPointsEarned)} coupon points from this booking!
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom Row: QR Code Stub + Slogan */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginTop: '4px'
              }}
            >
              {/* QR Code and Barcode styling */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  backgroundColor: '#f0f7ff',
                  padding: '10px 18px',
                  borderRadius: '14px',
                  border: '1.5px solid #dbeafe'
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <QrCode size={32} color="#0f172a" />
                </div>

                <div style={{ width: '1.5px', height: '34px', backgroundColor: '#93c5fd' }} />

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                    AEROWINGS BOARDING SCAN
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {booking.bookingReference}
                  </div>
                </div>
              </div>

              {/* Slogan with stylish cursive font and curved underline */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: '8px' }}>
                <div
                  style={{
                    fontFamily: "'Caveat', 'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive",
                    fontSize: '1.65rem',
                    fontWeight: 700,
                    color: '#4c1d95',
                    letterSpacing: '0.02em',
                    lineHeight: 1.1,
                    fontStyle: 'italic',
                    textShadow: '0 1px 2px rgba(76, 29, 149, 0.08)'
                  }}
                >
                  Fly Better. Go Further.
                </div>
                <svg width="150" height="14" viewBox="0 0 150 14" fill="none" style={{ marginTop: '2px' }}>
                  <path d="M5 4C45 12 105 12 145 3" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Wave Bottom Bar like Image 2 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '24px',
            overflow: 'hidden',
            backgroundColor: '#ffffff'
          }}
        >
          <svg
            viewBox="0 0 780 24"
            fill="none"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <path
              d="M0 16 Q 300 0, 780 12 L 780 24 L 0 24 Z"
              fill="url(#cardBottomGradient)"
            />
            <path
              d="M0 16 Q 300 0, 780 12"
              stroke="#f59e0b"
              strokeWidth="2.5"
              fill="none"
            />
            <defs>
              <linearGradient id="cardBottomGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="50%" stopColor="#1e40af" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {cancelMessage && (
        <div style={{ width: '100%', maxWidth: '780px', padding: '14px 18px', borderRadius: '12px', backgroundColor: '#ecfdf5', border: '1px solid #86efac', color: '#065f46', fontSize: '0.9rem', textAlign: 'center' }}>
          {cancelMessage}
        </div>
      )}

      {cancelError && (
        <div role="alert" style={{ width: '100%', maxWidth: '780px', padding: '14px 18px', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.9rem', textAlign: 'center' }}>
          {cancelError}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }} className="no-print">
        {booking.bookingStatus?.toLowerCase() !== 'cancelled' && (
          <button
            onClick={handleCancelTicket}
            disabled={cancelling}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: cancelling ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.15)'
            }}
          >
            <XCircle size={18} />
            <span>{cancelling ? 'Cancelling Ticket...' : 'Cancel Ticket'}</span>
          </button>
        )}

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
