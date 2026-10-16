import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plane,
  Clock,
  User,
  Mail,
  Phone,
  Tag,
  CheckCircle,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { bookingApi, couponApi } from '../services/api';
import { authUtil } from '../utils/auth';
import { calculateClassFare, formatINR, getClassMultiplier } from '../utils/flightPricing';

export default function FlightBooking() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = authUtil.getUser();
  const initialFlight = location.state?.flight;
  const initialCouponCode = location.state?.couponCode || '';
  const selectedClass = location.state?.selectedClass || 'Economy';
  const passengerCount = Math.min(27, Math.max(1, Number(location.state?.passengerCount) || 1));

  const flight = initialFlight || null;

  // Form State
  const [passengerName, setPassengerName] = useState(user?.fullName || '');
  const [passengerEmail, setPassengerEmail] = useState(user?.email || '');
  const [passengerPhone, setPassengerPhone] = useState(user?.phoneNumber || '');
  const [passengerAge, setPassengerAge] = useState(28);
  const [passengerGender, setPassengerGender] = useState('Male');
  const [seatNumber, setSeatNumber] = useState('14B');
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');

  // Coupon State
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [passengerCoupons, setPassengerCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(true);
  const [couponsError, setCouponsError] = useState('');
  const [couponBalance, setCouponBalance] = useState(null);
  const [couponBalanceError, setCouponBalanceError] = useState('');
  const [redeemCouponPoints, setRedeemCouponPoints] = useState(false);

  // Booking State
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const submittingRef = useRef(false);
  const bookingRequestKeyRef = useRef(null);
  if (!bookingRequestKeyRef.current) {
    bookingRequestKeyRef.current = crypto.randomUUID();
  }

  // Form validation errors
  const [formErrors, setFormErrors] = useState({});

  const loadPassengerCoupons = useCallback(async () => {
    setCouponsError('');
    try {
      const response = await couponApi.getAvailable();
      setPassengerCoupons(response.data);
    } catch (err) {
      setCouponsError(err.response?.data?.message || 'Unable to load your coupons.');
    } finally {
      setCouponsLoading(false);
    }
  }, []);

  const loadCouponBalance = useCallback(async () => {
    setCouponBalanceError('');
    try {
      const response = await couponApi.getBalance();
      setCouponBalance(response.data);
    } catch (err) {
      setCouponBalanceError(err.response?.data?.message || 'Unable to load your coupon point balance.');
    }
  }, []);

  useEffect(() => {
    loadPassengerCoupons();
    loadCouponBalance();
    const refreshInterval = window.setInterval(() => {
      loadPassengerCoupons();
      loadCouponBalance();
    }, 30000);
    const refreshOnFocus = () => {
      loadPassengerCoupons();
      loadCouponBalance();
    };
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [loadCouponBalance, loadPassengerCoupons]);

  if (!flight) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <Plane size={48} color="#0284c7" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>No flight selected</h2>
        <p style={{ color: '#64748b', margin: '8px 0 20px' }}>
          Search for a flight and select one before continuing to booking.
        </p>
        <button
          type="button"
          onClick={() => navigate('/availability')}
          style={{
            padding: '11px 20px',
            borderRadius: '10px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontWeight: 700
          }}
        >
          Search Flights
        </button>
      </div>
    );
  }

  // Calculate pricing breakdown
  const baseFarePerPassenger = Math.round(Number(flight.price) || 0);
  const classFarePerPassenger = calculateClassFare(baseFarePerPassenger, selectedClass);
  const originalFare = classFarePerPassenger === null ? NaN : Math.round(classFarePerPassenger * passengerCount);
  const fareAvailable = Number.isFinite(originalFare) && originalFare > 0;
  const discountAmount = appliedCoupon
    ? Math.round(Math.min(Number(appliedCoupon.discountAmount) || 0, originalFare))
    : 0;
  const availableCouponPoints = Math.round(Number(couponBalance?.availablePoints) || 0);
  const remainingFareAfterCoupon = Math.max(0, originalFare - discountAmount);
  const availablePointsDiscount = appliedCoupon
    ? 0
    : Math.floor(Math.min(availableCouponPoints / 10, remainingFareAfterCoupon));
  const pointsDiscountAmount = (redeemCouponPoints && !appliedCoupon) ? availablePointsDiscount : 0;
  const totalAmount = Math.max(0, Math.round(originalFare - discountAmount - pointsDiscountAmount));

  // Validate coupon via API
  const handleApplyCoupon = async (codeToApply) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const response = await couponApi.validate(code, flight.flightId, selectedClass, passengerCount);
      const data = response.data;

      if (data.isValid) {
        setAppliedCoupon(data);
        setCouponCode(code);
        setCouponSuccess(data.message);
      } else {
        setAppliedCoupon(null);
        setCouponError(data.message || 'Invalid coupon.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to validate coupon.';
      setAppliedCoupon(null);
      setCouponError(msg);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponSuccess('');
    setCouponError('');
  };

  const validatePassengerDetails = () => {
    const errs = {};
    if (!passengerName.trim()) errs.passengerName = 'Passenger name is required';
    if (!passengerEmail.trim()) errs.passengerEmail = 'Passenger email is required';
    if (!passengerPhone.trim()) errs.passengerPhone = 'Passenger phone is required';
    if (!passengerAge || passengerAge < 1 || passengerAge > 120) errs.passengerAge = 'Valid age is required';
    if (!seatNumber.trim()) errs.seatNumber = 'Please choose a seat number';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setBookingError('');

    if (!fareAvailable) {
      setBookingError('This flight has no route distance, so its fare cannot be calculated. Ask an administrator to update the flight.');
      return;
    }

    if (!validatePassengerDetails()) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = {
        idempotencyKey: bookingRequestKeyRef.current,
        flightId: flight.flightId,
        passengerName,
        passengerEmail,
        passengerPhone,
        passengerAge: Number(passengerAge),
        passengerGender,
        seatNumber,
        class: selectedClass,
        passengerCount,
        couponCode: appliedCoupon ? appliedCoupon.couponCode : undefined,
        redeemCouponPoints,
        paymentMethod
      };

      const response = await bookingApi.create(payload);
      const confirmedBooking = response.data;
      await loadCouponBalance();
      let couponPageData = null;
      let couponRefreshError = '';
      try {
        const [couponsResponse, statisticsResponse] = await Promise.all([
          couponApi.getAll(),
          couponApi.getStatistics()
        ]);
        couponPageData = {
          coupons: couponsResponse.data,
          statistics: statisticsResponse.data
        };
      } catch (refreshError) {
        couponRefreshError = refreshError.response?.data?.message ||
          'Your booking succeeded, but coupon details could not be refreshed. Open Coupons and refresh to try again.';
      }

      // Navigate to Booking Confirmation Ticket
      navigate('/booking-confirmation', {
        state: { booking: confirmedBooking, couponPageData, couponRefreshError },
        replace: true
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Booking process failed. Please check seat availability or coupon validity.';
      setBookingError(msg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Sample quick seats
  const sampleSeats = ['11A', '11B', '12A', '12B', '13A', '13B', '14A', '14B', '15A', '15B', '16C', '16D', '17C', '17D', '18C', '18D', '19C', '19D', '20C', '20D'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-in">
      {/* Breadcrumb & Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b', marginBottom: '6px' }}>
          <span>Flights</span>
          <ChevronRight size={14} />
          <span style={{ color: '#0284c7', fontWeight: 600 }}>Booking Checkout</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Complete Flight Reservation
        </h1>
      </div>

      {bookingError && (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <span>{bookingError}</span>
        </div>
      )}

      {/* Main 2-Column Checkout Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '28px' }} className="booking-checkout-grid">
        {/* Left Column: Flight Summary & Passenger Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Selected Flight Summary Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plane size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{flight.airline}</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    Flight #{flight.flightNumber}
                  </span>
                </div>
              </div>

            </div>

            {/* Flight Route Visual */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #f1f5f9'
              }}
            >
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{flight.departureTime}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{flight.fromCity}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{flight.departureDate}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                  <Clock size={12} />
                  <span>{flight.duration}</span>
                </div>
                <div style={{ width: '80px', height: '2px', backgroundColor: '#cbd5e1', margin: '6px 0', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '50%', top: '-8px', transform: 'translateX(-50%)', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plane size={9} color="#ffffff" style={{ transform: 'rotate(45deg)' }} />
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Direct Flight</span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  {flight.distanceKm ? `${flight.distanceKm} km` : 'Distance unavailable'}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{flight.arrivalTime}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{flight.toCity}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{flight.arrivalDate}</div>
              </div>
            </div>
          </div>

          {/* Passenger Information Form */}
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
              Passenger Details
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Passenger Full Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="As shown on passport or government ID"
                    style={{
                      width: '100%',
                      padding: '11px 16px 11px 42px',
                      borderRadius: '12px',
                      border: `1px solid ${formErrors.passengerName ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  />
                </div>
                {formErrors.passengerName && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{formErrors.passengerName}</span>}
              </div>

              {/* Email & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      value={passengerEmail}
                      onChange={(e) => setPassengerEmail(e.target.value)}
                      placeholder="Ticket will be sent here"
                      style={{
                        width: '100%',
                        padding: '11px 16px 11px 42px',
                        borderRadius: '12px',
                        border: `1px solid ${formErrors.passengerEmail ? '#ef4444' : '#cbd5e1'}`,
                        fontSize: '0.92rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  {formErrors.passengerEmail && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{formErrors.passengerEmail}</span>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Phone Number *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="tel"
                      value={passengerPhone}
                      onChange={(e) => setPassengerPhone(e.target.value)}
                      placeholder="+1 555-0199"
                      style={{
                        width: '100%',
                        padding: '11px 16px 11px 42px',
                        borderRadius: '12px',
                        border: `1px solid ${formErrors.passengerPhone ? '#ef4444' : '#cbd5e1'}`,
                        fontSize: '0.92rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  {formErrors.passengerPhone && <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '3px', display: 'block' }}>{formErrors.passengerPhone}</span>}
                </div>
              </div>

              {/* Age, Gender & Seat Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Age *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={passengerAge}
                    onChange={(e) => setPassengerAge(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Gender *
                  </label>
                  <select
                    value={passengerGender}
                    onChange={(e) => setPassengerGender(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Seat Number *
                  </label>
                  <input
                    type="text"
                    value={seatNumber}
                    onChange={(e) => setSeatNumber(e.target.value)}
                    placeholder="e.g. 14B"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${formErrors.seatNumber ? '#ef4444' : '#cbd5e1'}`,
                      fontSize: '0.92rem',
                      outline: 'none',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>

              {/* Quick Seat Selector Buttons */}
              <div>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Select from Available Seats:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {sampleSeats.map((seat) => (
                    <button
                      key={seat}
                      type="button"
                      onClick={() => setSeatNumber(seat)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        border: seatNumber === seat ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        backgroundColor: seatNumber === seat ? '#e0f2fe' : '#f8fafc',
                        color: seatNumber === seat ? '#0284c7' : '#334155'
                      }}
                    >
                      {seat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulated Payment Method */}
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Simulated Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {['Credit Card', 'Debit Card', 'UPI / NetBanking'].map((method) => (
                    <div
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: paymentMethod === method ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        backgroundColor: paymentMethod === method ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: paymentMethod === method ? '#0284c7' : '#475569'
                      }}
                    >
                      <CreditCard size={18} style={{ margin: '0 auto 4px' }} />
                      <div>{method}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Coupon Section & Price Summary Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Coupon Section */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Tag size={20} color="#0284c7" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Apply Promo Coupon
              </h3>
            </div>

            <div style={{ padding: '14px', marginBottom: '16px', borderRadius: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                <span>Available coupon points</span>
                <span>{availableCouponPoints.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '5px', fontSize: '0.82rem', color: '#475569' }}>
                <span>Discount value (10 points = ₹1)</span>
                <span>{formatINR(Number(couponBalance?.availableDiscountAmount) || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '5px', fontSize: '0.78rem', color: '#64748b' }}>
                <span>Pending / redeemed / total</span>
                <span>
                  {(Number(couponBalance?.pendingPoints) || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 })} /
                  {' '}{(Number(couponBalance?.redeemedPoints) || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 })} /
                  {' '}{(Number(couponBalance?.totalPoints) || 0).toLocaleString('en-IN', { maximumFractionDigits: 4 })}
                </span>
              </div>
              {couponBalanceError && (
                <p style={{ marginTop: '8px', fontSize: '0.78rem', color: '#dc2626' }}>{couponBalanceError}</p>
              )}
              <button
                type="button"
                onClick={() => setRedeemCouponPoints((applied) => !applied)}
                disabled={availableCouponPoints <= 0}
                style={{
                  marginTop: '12px',
                  padding: '9px 12px',
                  borderRadius: '9px',
                  backgroundColor: redeemCouponPoints ? '#dcfce7' : '#0284c7',
                  color: redeemCouponPoints ? '#166534' : '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: availableCouponPoints > 0 ? 'pointer' : 'not-allowed',
                  opacity: availableCouponPoints > 0 ? 1 : 0.6
                }}
              >
                {redeemCouponPoints
                  ? `Remove Points Discount (${formatINR(availablePointsDiscount)})`
                  : `Apply Points - Save up to ${formatINR(availablePointsDiscount)}`}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Enter Coupon Code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  textTransform: 'uppercase'
                }}
              />
              <button
                type="button"
                onClick={() => handleApplyCoupon()}
                disabled={couponLoading}
                style={{
                  padding: '11px 20px',
                  borderRadius: '12px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem'
                }}
              >
                {couponLoading ? 'Checking...' : 'Apply'}
              </button>
            </div>

            {/* Success feedback */}
            {couponSuccess && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '10px',
                  color: '#065f46',
                  fontSize: '0.82rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} color="#059669" />
                  <span>{couponSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  style={{ background: 'none', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  Remove
                </button>
              </div>
            )}

            {/* Error feedback */}
            {couponError && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#991b1b',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} color="#dc2626" />
                <span>{couponError}</span>
              </div>
            )}

            <div style={{ marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                Available Coupons (Select to Apply)
              </h4>
              {couponsLoading && (
                <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Loading your coupons...</p>
              )}
              {couponsError && (
                <p style={{ fontSize: '0.82rem', color: '#dc2626' }}>{couponsError}</p>
              )}
              {!couponsLoading && !couponsError && passengerCoupons.length === 0 && (
                <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No available coupons</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {passengerCoupons.map((coupon) => {
                  return (
                    <div
                      key={coupon.couponId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                          {coupon.couponCode} · {formatINR(coupon.discountAmount ?? coupon.discountValue)} off
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '3px' }}>
                          {Number(coupon.couponPoints) > 0 && `${Math.round(coupon.couponPoints)} points · `}
                          {Number(coupon.discountPercentage) > 0 && `${Math.round(coupon.discountPercentage)}% · `}
                          Status: {coupon.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon(coupon.couponCode)}
                        disabled={couponLoading}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Pricing Summary Breakdown */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '18px' }}>
              Fare Breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Selected Traveller Class</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedClass}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Economy Base Fare (per traveller)</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatINR(baseFarePerPassenger)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Class fare × passengers ({passengerCount})</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{fareAvailable ? formatINR(originalFare) : 'Fare unavailable'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 600 }}>
                <span>Promo Coupon Discount{appliedCoupon ? ` (${appliedCoupon.couponCode})` : ''}</span>
                <span>-{formatINR(discountAmount)}</span>
              </div>

              {redeemCouponPoints && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 600 }}>
                  <span>Points Discount ({(pointsDiscountAmount * 10).toLocaleString('en-IN', { maximumFractionDigits: 4 })} points)</span>
                  <span>-{formatINR(pointsDiscountAmount)}</span>
                </div>
              )}

              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '6px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Final Payable Amount</span>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>All inclusive</div>
                </div>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7' }}>
                  {fareAvailable ? formatINR(totalAmount) : 'Fare unavailable'}
                </span>
              </div>
            </div>

            {/* Confirm Booking CTA */}
            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={submitting || !fareAvailable}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '14px',
                borderRadius: '14px',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
                opacity: submitting || !fareAvailable ? 0.6 : 1,
                cursor: submitting || !fareAvailable ? 'not-allowed' : 'pointer'
              }}
              onMouseEnter={(e) => { if (!submitting && fareAvailable) e.currentTarget.style.backgroundColor = '#0369a1'; }}
              onMouseLeave={(e) => { if (!submitting && fareAvailable) e.currentTarget.style.backgroundColor = '#0284c7'; }}
            >
              {submitting ? (
                <span>Processing Reservation...</span>
              ) : (
                <>
                  <span>{fareAvailable ? `Confirm Booking (${formatINR(totalAmount)})` : 'Fare unavailable'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b', marginTop: '14px' }}>
              <ShieldCheck size={14} color="#059669" />
              <span>Simulated Instant Confirmation & Zero Cancellation Fee</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 990px) {
          .booking-checkout-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
