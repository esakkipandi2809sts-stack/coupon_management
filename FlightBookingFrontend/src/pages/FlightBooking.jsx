import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plane, Clock, User, Tag, CheckCircle, AlertCircle, CreditCard,
  ShieldCheck, ChevronRight, ArrowRight, ChevronDown
} from 'lucide-react';

import { bookingApi, couponApi, flightApi } from '../services/api';
import { authUtil } from '../utils/auth';
import { calculateClassFare, formatINR } from '../utils/flightPricing';
import './Availability.css';

const EMPTY_PASSENGER = {
  title: 'Mr',
  firstName: '',
  lastName: '',
  name: '',
  email: '',
  dob: '',
  phone: '',
  age: '',
  gender: 'Male',
  seat: ''
};

const PAYMENT_METHODS = ['Credit Card', 'Debit Card', 'UPI / NetBanking'];
const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr'];

const styles = {
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18,
    padding: 24, boxShadow: '0 4px 15px rgba(0,0,0,0.03)', minWidth: 0
  },
  label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10,
    border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff'
  },
  primaryButton: {
    width: '100%', padding: 13, border: 0, borderRadius: 12, background: '#0284c7',
    color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
  },
  error: {
    padding: 12, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
    borderRadius: 10, fontSize: '0.85rem'
  }
};

const LEFT = ['A', 'B', 'C'];
const RIGHT = ['D', 'E', 'F'];

/* ---------------- SEAT MAP (named component, not a default export) ---------------- */

function SeatMap({
  bookedSeats = [],
  selectedSeat = '',
  onSelect = () => { },
  startRow = 11,
  endRow = 30,
  exitRows = [],
}) {
  const booked = new Set(bookedSeats.map(s => String(s).toUpperCase()));
  const rows = Array.from({ length: endRow - startRow + 1 }, (_, i) => startRow + i);

  const renderSeat = (row, col) => {
    const id = `${row}${col}`;
    const isBooked = booked.has(id);
    const isSelected = selectedSeat === id;
    const cls = isBooked ? 'seat booked' : isSelected ? 'seat selected' : 'seat available';

    return (
      <button
        key={id}
        type="button"
        className={cls}
        disabled={isBooked}
        aria-pressed={isSelected}
        aria-label={`Seat ${id} ${isBooked ? 'booked' : isSelected ? 'selected' : 'available'}`}
        title={`Seat ${id} is ${isBooked ? 'booked' : 'available'}`}
        onClick={() => onSelect(id)}
      >
        {col}
      </button>
    );
  };

  return (
    <div className="seatmap">
      <div className="seatmap-legend">
        <span><i className="dot available" /> Available</span>
        <span><i className="dot selected" /> Selected</span>
        <span><i className="dot booked" /> Booked</span>
      </div>

      <div className="plane">
        <div className="plane-nose">Front</div>

        <div className="plane-cols">
          <div className="grp">{LEFT.map(c => <span key={c}>{c}</span>)}</div>
          <div className="aisle" />
          <div className="grp">{RIGHT.map(c => <span key={c}>{c}</span>)}</div>
        </div>

        <div className="plane-body">
          {rows.map(row => (
            <div key={row} className={`seat-row ${exitRows.includes(row) ? 'exit-row' : ''}`}>
              <div className="grp">{LEFT.map(c => renderSeat(row, c))}</div>
              <div className="aisle row-no">{row}</div>
              <div className="grp">{RIGHT.map(c => renderSeat(row, c))}</div>
            </div>
          ))}
        </div>

        <div className="plane-tail">Rear</div>
      </div>

      <p className="seatmap-note">
        {selectedSeat ? `Selected seat: ${selectedSeat}` : 'Tap a seat to pick or change.'}
      </p>
    </div>
  );
}

/* ---------------- FORM FIELD ---------------- */

function FormField({ label, value, onChange, error, type = 'text', placeholder = '', min, max, options }) {
  const inputStyle = { ...styles.input, borderColor: error ? '#ef4444' : '#cbd5e1' };

  return (
    <div style={{ minWidth: 0 }}>
      <label style={styles.label}>{label}</label>

      {options ? (
        <select value={value} onChange={onChange} style={inputStyle}>
          <option value="">Select {label.replace(' *', '')}</option>
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          type={type} value={value} onChange={onChange}
          placeholder={placeholder} min={min} max={max} style={inputStyle}
        />
      )}

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.75rem', margin: '4px 0 0' }}>{error}</p>
      )}
    </div>
  );
}

/* ---------------- HELPERS ---------------- */

const calculateAgeFromDob = dobString => {
  if (!dobString) return '';
  const d = new Date(dobString);
  if (Number.isNaN(d.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;

  return age >= 0 ? String(age) : '0';
};

const getCouponCode = coupon => String(coupon?.couponCode || coupon?.code || '').trim().toUpperCase();

const getDiscountText = c => {
  if (c.discountPercentage) return `${c.discountPercentage}% OFF`;
  if (c.discountAmount) return `₹${c.discountAmount} OFF`;
  if (c.discountValue) {
    return `${c.discountType === 'Percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`} OFF`;
  }
  return '';
};

const makeRequestKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/* ---------------- MAIN COMPONENT ---------------- */

export default function FlightBooking() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = authUtil.getUser();

  const flight = location.state?.flight || null;
  const flightId = flight?.flightId || flight?.id;
  const selectedClass = location.state?.selectedClass || 'Economy';

  const passengerCount = Math.min(27, Math.max(1, Number(location.state?.passengerCount) || 1));
  const initialCouponCode = location.state?.couponCode || '';

  const [passengers, setPassengers] = useState(() => {
    const defaultName = (user?.fullName || '').trim();
    const parts = defaultName.split(' ');
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ') || '';

    return [{
      ...EMPTY_PASSENGER,
      firstName: first,
      lastName: last,
      name: defaultName,
      email: user?.email || '',
      phone: user?.phoneNumber || ''
    }];
  });

  const [paymentMethod, setPaymentMethod] = useState('Credit Card');
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [appliedCoupons, setAppliedCoupons] = useState([]);

  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  const [couponsLoading, setCouponsLoading] = useState(true);
  const [couponsError, setCouponsError] = useState('');
  const [passengerCoupons, setPassengerCoupons] = useState([]);
  const [showCouponDropdown, setShowCouponDropdown] = useState(false);
  const couponDropdownRef = useRef(null);

  const [couponBalance, setCouponBalance] = useState(null);
  const [couponBalanceError, setCouponBalanceError] = useState('');

  const [creatingCoupon, setCreatingCoupon] = useState(false);
  // Points are only used to CREATE a coupon; the coupon is then applied via the code box.
  const [pointsToRedeem, setPointsToRedeem] = useState('');

  const [bookedSeats, setBookedSeats] = useState(() =>
    Array.isArray(flight?.bookedSeats)
      ? flight.bookedSeats.map(s => String(s).trim().toUpperCase())
      : []
  );

  const [formErrors, setFormErrors] = useState({});
  const [bookingError, setBookingError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const bookingRequestKeyRef = useRef(null);
  if (!bookingRequestKeyRef.current) {
    bookingRequestKeyRef.current = makeRequestKey();
  }

  /* ---------- data loading ---------- */

  const loadPassengerCoupons = useCallback(async () => {
    try {
      setCouponsLoading(true);
      setCouponsError('');
      const response = await couponApi.getAvailable();
      setPassengerCoupons(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setCouponsError(err.response?.data?.message || 'Unable to load available coupons.');
    } finally {
      setCouponsLoading(false);
    }
  }, []);

  const loadCouponBalance = useCallback(async () => {
    try {
      setCouponBalanceError('');
      const response = await couponApi.getBalance();
      setCouponBalance(response.data);
    } catch (err) {
      setCouponBalanceError(
        err.response?.data?.message || 'Unable to load your coupon point balance.'
      );
    }
  }, []);

  const loadBookedSeats = useCallback(async () => {
    if (!flightId) return;
    try {
      const response = await flightApi.getBookedSeats(flightId);
      if (Array.isArray(response.data)) {
        setBookedSeats(response.data.map(s => String(s).trim().toUpperCase()));
      }
    } catch (err) {
      console.error('Failed to load booked seats for flight', err);
    }
  }, [flightId]);

  useEffect(() => {
    loadPassengerCoupons();
    loadCouponBalance();
    loadBookedSeats();
  }, [loadPassengerCoupons, loadCouponBalance, loadBookedSeats]);

  useEffect(() => {
    const handleClickOutside = event => {
      if (couponDropdownRef.current && !couponDropdownRef.current.contains(event.target)) {
        setShowCouponDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ---------- passengers ---------- */

  const updatePassenger = (index, field, value) => {
    setPassengers(previous =>
      previous.map((p, i) => {
        if (i !== index) return p;
        const updated = { ...p, [field]: value };

        if (field === 'firstName' || field === 'lastName') {
          updated.name = [updated.firstName, updated.lastName]
            .map(part => (part || '').trim())
            .filter(Boolean)
            .join(' ');
        }

        if (field === 'dob') {
          const autoAge = calculateAgeFromDob(value);
          if (autoAge !== '') updated.age = autoAge;
        }

        return updated;
      })
    );

    setFormErrors(previous => {
      if (!previous[index]) return previous;
      const next = { ...previous, [index]: { ...previous[index] } };
      delete next[index][field];
      if (field === 'dob') delete next[index].age;
      return next;
    });
  };

  const addPassenger = () => {
    if (passengers.length >= passengerCount) return;
    setPassengers(previous => [...previous, { ...EMPTY_PASSENGER }]);
  };

  const removePassenger = index => {
    setPassengers(previous => previous.filter((_, i) => i !== index));

    setFormErrors(previous => {
      const next = {};
      Object.keys(previous).forEach(key => {
        const oldIndex = Number(key);
        if (oldIndex < index) next[oldIndex] = previous[oldIndex];
        if (oldIndex > index) next[oldIndex - 1] = previous[oldIndex];
      });
      return next;
    });
  };

  const validatePassengers = () => {
    const errors = {};

    if (passengers.length !== passengerCount) {
      setBookingError(`Please add all ${passengerCount} passenger(s) before booking.`);
      return false;
    }

    passengers.forEach((passenger, index) => {
      const err = {};

      if (!passenger.title) err.title = 'Select a title.';
      if (!passenger.firstName?.trim()) err.firstName = 'First name is required.';
      if (!passenger.lastName?.trim()) err.lastName = 'Last name is required.';

      if (!passenger.dob) {
        err.dob = 'Date of birth is required.';
      } else if (new Date(passenger.dob) > new Date()) {
        err.dob = 'Date of birth cannot be in the future.';
      }

      const email = (passenger.email || user?.email || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err.email = 'Enter a valid email address.';
      }

      if (!passenger.phone?.trim()) {
        err.phone = 'Phone number is required.';
      } else if (passenger.phone.replace(/\D/g, '').length < 7) {
        err.phone = 'Enter a valid phone number.';
      }

      const age = Number(passenger.age);
      if (passenger.age === '' || !Number.isInteger(age) || age < 1 || age > 120) {
        err.age = 'Enter a valid age between 1 and 120.';
      }

      if (!passenger.gender) err.gender = 'Select a gender.';

      if (passenger.seat) {
        const seat = passenger.seat.trim().toUpperCase();
        if (bookedSeats.includes(seat)) {
          err.seat = `Seat ${seat} has already been booked. Please choose another seat.`;
        } else if (
          passengers.some((other, otherIndex) =>
            otherIndex !== index && other.seat?.trim().toUpperCase() === seat
          )
        ) {
          err.seat = 'This seat is selected by another passenger.';
        }
      }

      if (Object.keys(err).length) errors[index] = err;
    });

    setFormErrors(errors);

    if (Object.keys(errors).length) {
      setBookingError('Please correct the passenger details.');
      return false;
    }
    return true;
  };

  /* ---------- fare calculation ---------- */

  const baseFarePerPassenger = Math.round(Number(flight?.price) || 0);

  const classFarePerPassenger = flight
    ? calculateClassFare(baseFarePerPassenger, selectedClass)
    : null;

  // Total fare for ALL passengers in the selected class
  const originalFare =
    classFarePerPassenger !== null && Number.isFinite(classFarePerPassenger)
      ? Math.round(classFarePerPassenger * passengerCount)
      : NaN;

  const fareAvailable = Number.isFinite(originalFare) && originalFare > 0;

  const rawCouponDiscount = appliedCoupons.reduce(
    (sum, coupon) => sum + Math.max(0, Number(coupon.discountAmount) || 0), 0
  );

  // Only coupons that are actually APPLIED reduce the payable amount; capped to the total fare.
  const totalDiscountAmount = fareAvailable
    ? Math.round(Math.min(rawCouponDiscount, originalFare))
    : 0;

  const totalAmount = fareAvailable ? Math.max(0, originalFare - totalDiscountAmount) : 0;

  const availableCouponPoints = Math.max(0, Math.floor(Number(couponBalance?.availablePoints) || 0));

  const parsedPoints = pointsToRedeem === '' ? 0 : Number(pointsToRedeem);
  const validPointsInput = Number.isInteger(parsedPoints) && parsedPoints >= 0;

  // 10 points = ₹1 (informational preview only; does NOT change the payable amount)
  const couponPreviewValue = validPointsInput && parsedPoints > 0 ? Math.floor(parsedPoints / 10) : 0;

  const unappliedPassengerCoupons = passengerCoupons.filter(coupon => {
    const code = getCouponCode(coupon);
    const isAvailable = (coupon.status || 'Available').toLowerCase() === 'available';
    return code && isAvailable && !appliedCoupons.some(c => getCouponCode(c) === code);
  });
  const displayedAvailableCoupons = unappliedPassengerCoupons.slice(0, 1);

  const filteredDisplayedCoupons = displayedAvailableCoupons.filter(c => {
    if (!couponCode) return true;
    return getCouponCode(c).includes(couponCode.toUpperCase());
  });

  /* ---------- create coupon from points ---------- */

  const handleCreateCoupon = async () => {
    setCouponError('');
    setCouponSuccess('');

    if (pointsToRedeem === '' || !validPointsInput || parsedPoints <= 0) {
      setCouponError('Please enter the points you want to convert into a coupon.');
      return;
    }

    if (parsedPoints < 10) {
      setCouponError('Minimum 10 points are required to create a coupon (10 points = ₹1).');
      return;
    }

    if (parsedPoints > availableCouponPoints) {
      setCouponError(
        `Insufficient points. You have ${availableCouponPoints} available points, but entered ${parsedPoints} points.`
      );
      return;
    }

    setCreatingCoupon(true);

    try {
      const response = await couponApi.createFromPoints(parsedPoints);
      const data = response.data;
      const createdCode = data?.couponCode || data?.code;

      if (!createdCode) {
        throw new Error('The server did not return a coupon code.');
      }

      setPointsToRedeem('');
      setCouponCode('');
      setCouponSuccess(
        `Coupon ${String(createdCode).toUpperCase()} created successfully! ${parsedPoints} points deducted. Enter or select the code above and click Apply.`
      );

      await loadCouponBalance();
      await loadPassengerCoupons();
    } catch (err) {
      setCouponError(err.response?.data?.message || err.message || 'Failed to create coupon.');
    } finally {
      setCreatingCoupon(false);
    }
  };

  /* ---------- apply / remove coupon ---------- */

  const handleApplyCoupon = async codeToApply => {
    const code = String(codeToApply ?? couponCode).trim().toUpperCase();

    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    if (!flightId) {
      setCouponError('Flight details are missing.');
      return;
    }

    if (appliedCoupons.some(coupon => getCouponCode(coupon) === code)) {
      setCouponError('This coupon is already applied.');
      return;
    }

    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const response = await couponApi.validate(code, flightId, selectedClass, passengerCount);
      const data = response.data;

      if (data?.isValid) {
        const validatedCoupon = { ...data, couponCode: data.couponCode || code };

        setAppliedCoupons(previous => {
          if (previous.some(c => getCouponCode(c) === code)) return previous;
          return [...previous, validatedCoupon];
        });

        setPointsToRedeem('');
        setCouponCode('');
        setCouponSuccess(data.message || `${code} applied successfully.`);
      } else {
        setCouponError(data?.message || 'This coupon is not valid.');
      }
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Failed to validate coupon.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = codeToRemove => {
    if (codeToRemove) {
      setAppliedCoupons(previous =>
        previous.filter(c => getCouponCode(c) !== codeToRemove.toUpperCase())
      );
    } else {
      setAppliedCoupons([]);
    }

    setCouponCode('');
    setCouponSuccess('');
    setCouponError('');
  };

  /* ---------- confirm booking ---------- */

  const handleConfirmBooking = async event => {
    event.preventDefault();

    if (submittingRef.current) return;

    setBookingError('');

    if (!flightId) {
      setBookingError('Flight details are missing. Please select a flight again.');
      return;
    }

    if (!fareAvailable) {
      setBookingError('The fare is unavailable.');
      return;
    }

    if (!validatePassengers()) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const firstPassenger = passengers[0];
      const primaryFullName = (
        firstPassenger.name || `${firstPassenger.firstName} ${firstPassenger.lastName}`
      ).trim();
      const primaryEmail = (firstPassenger.email || user?.email || '').trim();

      const payload = {
        idempotencyKey: bookingRequestKeyRef.current,
        flightId,
        passengerName: primaryFullName,
        passengerEmail: primaryEmail,
        passengerPhone: (firstPassenger.phone || '').trim(),
        passengerDob: firstPassenger.dob || '',
        dateOfBirth: firstPassenger.dob || '',
        passengerAge: Number(firstPassenger.age),
        passengerGender: firstPassenger.gender || 'Male',
        seatNumber: (firstPassenger.seat || '').trim().toUpperCase(),
        class: selectedClass,
        passengerCount,
        paymentMethod,

        couponCode: appliedCoupons[0]?.couponCode || undefined,
        couponCodes: appliedCoupons.map(coupon => coupon.couponCode),

        // Points are converted to a coupon beforehand, so none are redeemed directly here.
        redeemCouponPoints: false,
        couponPointsToRedeem: 0,

        passengers: passengers.map(passenger => {
          const fullName = (
            passenger.name || `${passenger.firstName} ${passenger.lastName}`
          ).trim();
          return {
            title: passenger.title || 'Mr',
            firstName: (passenger.firstName || '').trim(),
            lastName: (passenger.lastName || '').trim(),
            name: fullName,
            email: (passenger.email || primaryEmail).trim(),
            phone: (passenger.phone || firstPassenger.phone || '').trim(),
            dob: passenger.dob || '',
            age: Number(passenger.age),
            gender: passenger.gender || 'Male',
            seat: (passenger.seat || '').trim().toUpperCase()
          };
        })
      };

      const response = await bookingApi.create(payload);
      const confirmedBooking = response.data;

      if (!confirmedBooking) {
        throw new Error('The booking API returned no booking details.');
      }

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
      } catch (err) {
        couponRefreshError =
          err.response?.data?.message ||
          'Booking succeeded, but coupon details could not be refreshed.';
      }

      await loadCouponBalance();

      navigate('/booking-confirmation', {
        state: { booking: confirmedBooking, couponPageData, couponRefreshError },
        replace: true
      });
    } catch (err) {
      console.error('Booking error:', err);
      console.error('Backend response:', err.response?.data);

      // A rejected (4xx) request can be corrected and re-sent, so it needs a fresh key.
      // Network/5xx errors keep the same key so a retry stays idempotent.
      const status = err.response?.status;
      if (status && status >= 400 && status < 500) {
        bookingRequestKeyRef.current = makeRequestKey();
      }

      // Refresh seats in case someone else took one meanwhile.
      loadBookedSeats();

      setBookingError(
        err.response?.data?.message || err.message || 'Booking failed. Please try again.'
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /* ---------- render ---------- */

  if (!flight) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Plane size={42} color="#0284c7" />
        <h2>No flight selected</h2>
        <p>Please search for a flight before booking.</p>
        <button type="button" style={styles.primaryButton} onClick={() => navigate('/availability')}>
          Search Flights
        </button>
      </div>
    );
  }

  const pointsInputDisabled =
    appliedCoupons.length > 0 ||
    !fareAvailable ||
    totalAmount <= 0 ||
    couponsLoading ||
    creatingCoupon;

  const createDisabled = pointsInputDisabled || creatingCoupon;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, color: '#0f172a' }}>
      <style>{`
        .booking-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr);
          gap: 24px;
          align-items: start;
        }
        .booking-three-fields {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 990px) {
          .booking-grid { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 600px) {
          .booking-three-fields { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, color: '#64748b',
          fontSize: '0.85rem', marginBottom: 8
        }}>
          <span>Flights</span>
          <ChevronRight size={14} />
          <span style={{ color: '#0284c7', fontWeight: 700 }}>Booking Checkout</span>
        </div>

        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: 0 }}>
          Complete Flight Reservation
        </h1>
      </div>

      {bookingError && (
        <div role="alert" style={styles.error}>
          <AlertCircle size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {bookingError}
        </div>
      )}

      <div className="booking-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Flight summary */}
          <section style={styles.card}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
              <Plane size={28} color="#0284c7" />
              <div>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{flight.airline}</h2>
                <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
                  Flight #{flight.flightNumber}
                </span>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
              gap: 12, padding: 16, borderRadius: 12, background: '#f8fafc'
            }}>
              <div>
                <strong style={{ fontSize: '1.2rem' }}>{flight.departureTime}</strong>
                <div>{flight.fromCity}</div>
                <small style={{ color: '#64748b' }}>{flight.departureDate}</small>
              </div>

              <div style={{ textAlign: 'center', color: '#64748b' }}>
                <Clock size={15} />
                <div style={{ fontSize: '0.8rem' }}>{flight.duration}</div>
                <div style={{ marginTop: 6 }}>
                  {flight.distanceKm ? `${flight.distanceKm} km` : 'Distance unavailable'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '1.2rem' }}>{flight.arrivalTime}</strong>
                <div>{flight.toCity}</div>
                <small style={{ color: '#64748b' }}>{flight.arrivalDate}</small>
              </div>
            </div>
          </section>

          {/* Passengers */}
          <section style={styles.card}>
            <h2 style={{ fontSize: '1.15rem', marginbottom: '5px' }}>Passenger Details</h2>

            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Add details for all {passengerCount} passenger(s).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {passengers.map((passenger, index) => {
                const errors = formErrors[index] || {};
                const selectedSeat = (passenger.seat || '').trim().toUpperCase();

                // Seats taken on the flight + seats already chosen by other passengers
                const unavailableSeats = [
                  ...bookedSeats,
                  ...passengers
                    .filter((_, otherIndex) => otherIndex !== index)
                    .map(other => (other.seat || '').trim().toUpperCase())
                    .filter(Boolean)
                ];

                return (
                  <div key={index} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 16
                    }}>
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>
                        <User size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        Passenger {index + 1}
                      </h3>

                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removePassenger(index)}
                          style={{ border: 0, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: 14 }} className="booking-three-fields">
                      <FormField
                        label="Title *"
                        value={passenger.title}
                        options={TITLES}
                        error={errors.title}
                        onChange={e => updatePassenger(index, 'title', e.target.value)}
                      />

                      <FormField
                        label="First Name *"
                        value={passenger.firstName}
                        placeholder="Enter First name"
                        error={errors.firstName}
                        onChange={e => updatePassenger(index, 'firstName', e.target.value)}
                      />

                      <FormField
                        label="Last Name *"
                        value={passenger.lastName}
                        placeholder="Enter Last name"
                        error={errors.lastName}
                        onChange={e => updatePassenger(index, 'lastName', e.target.value)}
                      />
                    </div>

                    <div className="booking-three-fields" style={{ marginBottom: 14 }}>
                      <FormField
                        label="Date of Birth *"
                        type="date"
                        value={passenger.dob}
                        error={errors.dob}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => updatePassenger(index, 'dob', e.target.value)}
                      />

                      <FormField
                        label="Age *"
                        type="number"
                        min="1"
                        max="120"
                        value={passenger.age}
                        placeholder="Age"
                        error={errors.age}
                        onChange={e => updatePassenger(index, 'age', e.target.value)}
                      />

                      <FormField
                        label="Gender *"
                        value={passenger.gender}
                        options={['Male', 'Female', 'Other']}
                        error={errors.gender}
                        onChange={e => updatePassenger(index, 'gender', e.target.value)}
                      />
                    </div>

                    <div className="booking-three-fields" style={{ marginBottom: 14 }}>
                      <FormField
                        label="Email Address *"
                        type="email"
                        value={passenger.email}
                        placeholder="passenger@example.com"
                        error={errors.email}
                        onChange={e => updatePassenger(index, 'email', e.target.value)}
                      />

                      <FormField
                        label="Phone Number *"
                        type="tel"
                        value={passenger.phone}
                        placeholder="+91 98765 43210"
                        error={errors.phone}
                        onChange={e => updatePassenger(index, 'phone', e.target.value)}
                      />

                      <FormField
                        label="Seat (Optional)"
                        value={passenger.seat}
                        placeholder="e.g. 14B"
                        error={errors.seat}
                        onChange={e => updatePassenger(index, 'seat', e.target.value.toUpperCase())}
                      />
                    </div>

                    <SeatMap
                      bookedSeats={unavailableSeats}
                      selectedSeat={selectedSeat}
                      onSelect={seat => updatePassenger(index, 'seat', selectedSeat === seat ? '' : seat)}
                    />
                  </div>
                );
              })}

              {passengers.length < passengerCount && (
                <button
                  type="button"
                  onClick={addPassenger}
                  style={{
                    ...styles.primaryButton,
                    background: '#f0f9ff',
                    color: '#0369a1',
                    border: '1px dashed #0284c7'
                  }}
                >
                  + Add Passenger ({passengers.length}/{passengerCount})
                </button>
              )}

              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                Passenger details added: {passengers.length}/{passengerCount}
              </p>
            </div>

            {/* Payment */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Payment Method</h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 10
              }}>
                {PAYMENT_METHODS.map(method => (
                  <button
                    type="button"
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    aria-pressed={paymentMethod === method}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: paymentMethod === method ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      background: paymentMethod === method ? '#f0f9ff' : '#fff',
                      color: paymentMethod === method ? '#0369a1' : '#475569',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <CreditCard size={19} />
                    <div style={{ marginTop: 6, fontSize: '0.8rem' }}>{method}</div>
                  </button>
                ))}
              </div>

              <small style={{ color: '#64748b' }}>
                This is a simulated payment selection, not a real payment gateway.
              </small>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Coupons */}
          <section style={styles.card}>
            <h2 style={{
              fontSize: '1.1rem', display: 'flex', gap: 8, alignItems: 'center',
              marginTop: 0, marginBottom: 16
            }}>
              <Tag size={20} color="#0284c7" />
              Apply Promo Coupon
            </h2>

            <div style={{ marginBottom: 15 }}>
              <p style={{
                fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 5
              }}>
                Available Points
              </p>

              <p style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 5px', lineHeight: 1.1 }}>
                {!couponBalance ? '…' : availableCouponPoints.toLocaleString()}
              </p>

              <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#2563eb', margin: 0 }}>
                ≈ ₹{!couponBalance ? '…' : (availableCouponPoints / 10).toFixed(1)} Cash Equivalent
              </p>

              {couponBalanceError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <p role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>
                    {couponBalanceError}
                  </p>
                  <button
                    type="button"
                    onClick={loadCouponBalance}
                    style={{
                      background: 'none', border: 'none', color: '#0284c7', fontSize: '0.78rem',
                      fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={e => { e.preventDefault(); setShowCouponDropdown(false); handleApplyCoupon(); }}>
              <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
                <div ref={couponDropdownRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => {
                      setCouponCode(e.target.value.toUpperCase());
                      setShowCouponDropdown(true);
                    }}
                    onFocus={() => {
                      if (displayedAvailableCoupons.length > 0) setShowCouponDropdown(true);
                    }}
                    placeholder={displayedAvailableCoupons.length > 0 ? 'Enter or select coupon code' : 'Enter coupon code'}
                    style={{
                      ...styles.input,
                      minWidth: 0,
                      paddingRight: displayedAvailableCoupons.length > 0 ? 34 : 12
                    }}
                    autoComplete="off"
                  />

                  {displayedAvailableCoupons.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCouponDropdown(prev => !prev)}
                      title="Show available coupon"
                      aria-label="Toggle available coupon dropdown"
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                        padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 4
                      }}
                    >
                      <ChevronDown
                        size={18}
                        style={{
                          transform: showCouponDropdown ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    </button>
                  )}

                  {showCouponDropdown && displayedAvailableCoupons.length > 0 && (
                    <div
                      style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                        maxHeight: 220, overflowY: 'auto', zIndex: 100
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
                          background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <span>Available Coupon</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 500, color: '#94a3b8' }}>Click to select</span>
                      </div>

                      {filteredDisplayedCoupons.map((c, idx) => {
                        const code = getCouponCode(c);
                        const discountText = getDiscountText(c);
                        const isSelected = couponCode === code;
                        return (
                          <div
                            key={c.couponId || code || idx}
                            onClick={() => {
                              setCouponCode(code);
                              setShowCouponDropdown(false);
                            }}
                            style={{
                              padding: '10px 12px', display: 'flex', justifyContent: 'space-between',
                              alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                              background: isSelected ? '#f0f9ff' : '#ffffff', transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = isSelected ? '#f0f9ff' : '#ffffff';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Tag size={14} color="#0284c7" />
                              <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                {code}
                              </span>
                            </div>
                            {discountText && (
                              <span
                                style={{
                                  background: '#ecfdf5', color: '#059669', fontSize: '0.75rem',
                                  fontWeight: 700, padding: '2px 8px', borderRadius: 6
                                }}
                              >
                                {discountText}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {filteredDisplayedCoupons.length === 0 && (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                          No matching available coupon
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={couponLoading}
                  style={{
                    ...styles.primaryButton,
                    width: 'auto',
                    whiteSpace: 'nowrap',
                    opacity: couponLoading ? 0.6 : 1
                  }}
                >
                  {couponLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>

              {displayedAvailableCoupons.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Available:</span>
                  {displayedAvailableCoupons.map((c, idx) => {
                    const code = getCouponCode(c);
                    const isSelected = couponCode === code;
                    return (
                      <button
                        key={c.couponId || code || idx}
                        type="button"
                        onClick={() => {
                          setCouponCode(code);
                          setShowCouponDropdown(false);
                        }}
                        style={{
                          border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                          background: isSelected ? '#0284c7' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#0284c7',
                          padding: '3px 8px', borderRadius: 6, fontSize: '0.75rem',
                          fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                          transition: 'all 0.15s'
                        }}
                        title={`Click to select ${code}`}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              )}
            </form>

            {couponSuccess && (
              <div style={{
                margin: '10px 0', padding: 10, background: '#ecfdf5', color: '#047857',
                borderRadius: 8, fontSize: '0.82rem'
              }}>
                <CheckCircle size={15} style={{ verticalAlign: 'middle' }} /> {couponSuccess}
              </div>
            )}

            {couponError && (
              <p role="alert" style={{ color: '#dc2626', fontSize: '0.82rem' }}>{couponError}</p>
            )}

            {appliedCoupons.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {appliedCoupons.map(coupon => (
                  <div
                    key={getCouponCode(coupon)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: '0.82rem', padding: '4px 0'
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {getCouponCode(coupon)} · -{formatINR(Number(coupon.discountAmount) || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCoupon(getCouponCode(coupon))}
                      style={{ border: 0, color: '#dc2626', background: 'transparent', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Convert points into a coupon code */}
            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 16, paddingTop: 14 }}>
              <label style={styles.label}>Points to Convert into Coupon</label>

              <input
                type="number"
                min="0"
                max={availableCouponPoints}
                step="1"
                value={pointsToRedeem}
                disabled={pointsInputDisabled}
                onChange={e => {
                  const value = e.target.value;

                  if (value === '') {
                    setPointsToRedeem('');
                    return;
                  }

                  const requested = Number(value);

                  if (Number.isInteger(requested) && requested >= 0) {
                    setPointsToRedeem(String(Math.min(requested, availableCouponPoints)));
                  }
                }}
                placeholder={`Enter points, e.g. ${availableCouponPoints}`}
                style={{
                  ...styles.input,
                  background: pointsInputDisabled ? '#f1f5f9' : '#fff'
                }}
              />

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 12, color: '#059669', marginTop: 10
              }}>
                <span>Coupon value</span>
                <strong>{formatINR(couponPreviewValue)}</strong>
                <button
                  type="button"
                  onClick={handleCreateCoupon}
                  disabled={createDisabled}
                  style={{
                    padding: '8px 14px', border: 0, borderRadius: 8, background: '#0284c7',
                    color: '#fff', fontWeight: 600, whiteSpace: 'nowrap',
                    cursor: createDisabled ? 'not-allowed' : 'pointer',
                    opacity: createDisabled ? 0.5 : 1
                  }}
                >
                  {creatingCoupon ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>

              <small style={{ display: 'block', color: '#64748b', marginTop: 6 }}>
                Available: {availableCouponPoints} points (10 points = ₹1)
              </small>

              {appliedCoupons.length > 0 && (
                <small style={{ display: 'block', color: '#64748b', marginTop: 5 }}>
                  Remove applied coupons before creating a new one from points.
                </small>
              )}
            </div>

            {couponsError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <p role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>
                  {couponsError}
                </p>
                <button
                  type="button"
                  onClick={loadPassengerCoupons}
                  style={{
                    background: 'none', border: 'none', color: '#0284c7', fontSize: '0.78rem',
                    fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </section>

          {/* Fare breakdown */}
          <section style={styles.card}>
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Fare Breakdown</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: '#475569' }}>Traveller class</span>
                <strong>{selectedClass}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: '#475569' }}>Base fare per passenger</span>
                <strong>{formatINR(baseFarePerPassenger)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: '#475569' }}>
                  {selectedClass} fare × {passengerCount} passenger(s)
                </span>
                <strong>{fareAvailable ? formatINR(originalFare) : 'Unavailable'}</strong>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 12, color: '#059669'
              }}>
                <span>Total coupon discount</span>
                <strong>-{formatINR(totalDiscountAmount)}</strong>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
                }}>
                  <strong>Final Payable Amount</strong>

                  <strong style={{ fontSize: '1.5rem', color: '#0284c7' }}>
                    {fareAvailable ? formatINR(totalAmount) : 'Unavailable'}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={submitting || !fareAvailable}
              style={{
                ...styles.primaryButton,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 22,
                opacity: submitting || !fareAvailable ? 0.6 : 1,
                cursor: submitting || !fareAvailable ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? (
                'Processing Reservation...'
              ) : (
                <>
                  Confirm Booking ({fareAvailable ? formatINR(totalAmount) : '—'})
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, color: '#64748b', fontSize: '0.75rem', marginTop: 14
            }}>
              <ShieldCheck size={15} color="#059669" />
              <span>Booking confirmation after successful API response</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
