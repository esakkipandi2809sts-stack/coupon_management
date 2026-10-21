
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plane,
  Clock,
  User,
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
import { calculateClassFare, formatINR } from '../utils/flightPricing';

const EMPTY_PASSENGER = {
  name: '',
  email: '',
  phone: '',
  age: '',
  gender: '',
  seat: ''
};

const SAMPLE_SEATS = [
  '11A', '11B', '12A', '12B',
  '13A', '13B', '14A', '14B',
  '15A', '15B', '16C', '16D',
  '17C', '17D', '18C', '18D',
  '19C', '19D', '20C', '20D'
];

const PAYMENT_METHODS = [
  'Credit Card',
  'Debit Card',
  'UPI / NetBanking'
];

const styles = {
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: 24,
    boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
    minWidth: 0
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#334155',
    marginBottom: 6
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    outline: 'none',
    background: '#fff'
  },
  primaryButton: {
    width: '100%',
    padding: 13,
    border: 0,
    borderRadius: 12,
    background: '#0284c7',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer'
  },
  error: {
    padding: 12,
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 10,
    fontSize: '0.85rem'
  }
};

function FormField({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder = '',
  min,
  max,
  options
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={styles.label}>{label}</label>

      {options ? (
        <select
          value={value}
          onChange={onChange}
          style={{
            ...styles.input,
            borderColor: error ? '#ef4444' : '#cbd5e1'
          }}
        >
          <option value="">Select {label.replace(' *', '')}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          min={min}
          max={max}
          style={{
            ...styles.input,
            borderColor: error ? '#ef4444' : '#cbd5e1'
          }}
        />
      )}

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.75rem', margin: '4px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function FlightBooking() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = authUtil.getUser();
  const flight = location.state?.flight || null;
  const selectedClass = location.state?.selectedClass || 'Economy';

  const passengerCount = Math.min(
    27,
    Math.max(1, Number(location.state?.passengerCount) || 1)
  );

  const initialCouponCode = location.state?.couponCode || '';

  const [passengers, setPassengers] = useState(() => [
    {
      ...EMPTY_PASSENGER,
      name: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phoneNumber || ''
    }
  ]);

  const [paymentMethod, setPaymentMethod] = useState('Credit Card');

  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  const [passengerCoupons, setPassengerCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(true);
  const [couponsError, setCouponsError] = useState('');

  const [couponBalance, setCouponBalance] = useState(null);
  const [couponBalanceError, setCouponBalanceError] = useState('');
  const [redeemCouponPoints, setRedeemCouponPoints] = useState(false);

  const [formErrors, setFormErrors] = useState({});
  const [bookingError, setBookingError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const bookingRequestKeyRef = useRef(null);

  if (!bookingRequestKeyRef.current) {
    bookingRequestKeyRef.current =
      typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const loadPassengerCoupons = useCallback(async () => {
    try {
      setCouponsError('');
      const response = await couponApi.getAvailable();

      setPassengerCoupons(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (err) {
      setCouponsError(
        err.response?.data?.message || 'Unable to load available coupons.'
      );
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
        err.response?.data?.message ||
        'Unable to load your coupon point balance.'
      );
    }
  }, []);

  useEffect(() => {
    loadPassengerCoupons();
    loadCouponBalance();
  }, [loadPassengerCoupons, loadCouponBalance]);

  const updatePassenger = (index, field, value) => {
    setPassengers((previous) =>
      previous.map((passenger, i) =>
        i === index
          ? { ...passenger, [field]: value }
          : passenger
      )
    );

    setFormErrors((previous) => {
      const next = { ...previous };

      if (next[index]) {
        next[index] = { ...next[index] };
        delete next[index][field];
      }

      return next;
    });
  };

  const addPassenger = () => {
    if (passengers.length >= passengerCount) return;

    setPassengers((previous) => [
      ...previous,
      { ...EMPTY_PASSENGER }
    ]);
  };

  const removePassenger = (index) => {
    setPassengers((previous) =>
      previous.filter((_, i) => i !== index)
    );

    setFormErrors((previous) => {
      const next = {};

      Object.keys(previous).forEach((key) => {
        const oldIndex = Number(key);

        if (oldIndex < index) {
          next[oldIndex] = previous[oldIndex];
        } else if (oldIndex > index) {
          next[oldIndex - 1] = previous[oldIndex];
        }
      });

      return next;
    });
  };

  const validatePassengers = () => {
    const errors = {};

    if (passengers.length !== passengerCount) {
      setBookingError(
        `Please add all ${passengerCount} passenger(s) before booking.`
      );
      return false;
    }

    passengers.forEach((passenger, index) => {
      const err = {};

      if (!passenger.name.trim()) {
        err.name = 'Passenger name is required.';
      }

      if (
        !passenger.email.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email.trim())
      ) {
        err.email = 'Enter a valid email address.';
      }

      if (!passenger.phone.trim()) {
        err.phone = 'Phone number is required.';
      } else if (
        passenger.phone.replace(/\D/g, '').length < 7
      ) {
        err.phone = 'Enter a valid phone number.';
      }

      const age = Number(passenger.age);

      if (
        passenger.age === '' ||
        !Number.isInteger(age) ||
        age < 1 ||
        age > 120
      ) {
        err.age = 'Enter a valid age between 1 and 120.';
      }

      if (!passenger.gender) {
        err.gender = 'Select a gender.';
      }

      if (passenger.seat) {
        const seat = passenger.seat.trim().toUpperCase();

        const duplicateSeat = passengers.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            other.seat.trim().toUpperCase() === seat
        );

        if (duplicateSeat) {
          err.seat = 'This seat is selected by another passenger.';
        }
      }

      if (Object.keys(err).length > 0) {
        errors[index] = err;
      }
    });

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      setBookingError('Please correct the passenger details.');
      return false;
    }

    return true;
  };

  const baseFarePerPassenger = Math.round(Number(flight?.price) || 0);

  const classFarePerPassenger = flight
    ? calculateClassFare(baseFarePerPassenger, selectedClass)
    : null;

  const originalFare =
    classFarePerPassenger !== null &&
      Number.isFinite(classFarePerPassenger)
      ? Math.round(classFarePerPassenger * passengerCount)
      : NaN;

  const fareAvailable =
    Number.isFinite(originalFare) && originalFare > 0;

  const discountAmount = appliedCoupon
    ? Math.round(
      Math.min(
        Math.max(0, Number(appliedCoupon.discountAmount) || 0),
        Number.isFinite(originalFare) ? originalFare : 0
      )
    )
    : 0;

  const availableCouponPoints = Math.max(
    0,
    Number(couponBalance?.availablePoints) || 0
  );

  const remainingFare = Math.max(0, (originalFare || 0) - discountAmount);

  const availablePointsDiscount = appliedCoupon
    ? 0
    : Math.floor(
      Math.min(availableCouponPoints / 10, remainingFare)
    );

  const pointsDiscountAmount =
    redeemCouponPoints && !appliedCoupon
      ? availablePointsDiscount
      : 0;

  const totalAmount = Math.max(
    0,
    Math.round(
      (Number.isFinite(originalFare) ? originalFare : 0) -
      discountAmount -
      pointsDiscountAmount
    )
  );

  const handleApplyCoupon = async (codeToApply) => {
    const code = (codeToApply ?? couponCode).trim().toUpperCase();

    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }

    if (!flight?.flightId) {
      setCouponError('Flight details are missing.');
      return;
    }

    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');

    try {
      const response = await couponApi.validate(
        code,
        flight.flightId,
        selectedClass,
        passengerCount
      );

      const data = response.data;

      if (data?.isValid) {
        setAppliedCoupon({
          ...data,
          couponCode: data.couponCode || code
        });

        setCouponCode(code);
        setRedeemCouponPoints(false);
        setCouponSuccess(data.message || 'Coupon applied successfully.');
      } else {
        setAppliedCoupon(null);
        setCouponError(data?.message || 'This coupon is not valid.');
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(
        err.response?.data?.message || 'Failed to validate coupon.'
      );
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

  const handleConfirmBooking = async (event) => {
    event.preventDefault();

    if (submittingRef.current) return;

    setBookingError('');

    if (!flight?.flightId) {
      setBookingError('Flight details are missing. Please select a flight again.');
      return;
    }

    if (!fareAvailable) {
      setBookingError('The fare is unavailable. Please select another flight or contact the administrator.');
      return;
    }

    if (!validatePassengers()) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const firstPassenger = passengers[0];

      // Keep the first passenger's fields at the top level for
      // compatibility with APIs that expect the existing booking DTO.
      const payload = {
        idempotencyKey: bookingRequestKeyRef.current,

        flightId: flight.flightId,

        passengerName: firstPassenger.name.trim(),
        passengerEmail: firstPassenger.email.trim(),
        passengerPhone: firstPassenger.phone.trim(),
        passengerAge: Number(firstPassenger.age),
        passengerGender: firstPassenger.gender,
        seatNumber: firstPassenger.seat.trim().toUpperCase(),

        class: selectedClass,
        passengerCount,
        paymentMethod,

        couponCode: appliedCoupon
          ? appliedCoupon.couponCode
          : undefined,

        redeemCouponPoints,

        // Your backend DTO must support this field for multi-passenger
        // bookings to persist every passenger's information.
        passengers: passengers.map((passenger) => ({
          name: passenger.name.trim(),
          email: passenger.email.trim(),
          phone: passenger.phone.trim(),
          age: Number(passenger.age),
          gender: passenger.gender,
          seat: passenger.seat.trim().toUpperCase()
        }))
      };

      console.log('Submitting booking:', payload);

      const response = await bookingApi.create(payload);

      const confirmedBooking = response.data;

      if (!confirmedBooking) {
        throw new Error(
          'The booking API returned no booking details.'
        );
      }

      console.log('Booking successful:', confirmedBooking);

      // Coupon refresh is separate from booking confirmation.
      // A coupon API error must not prevent successful navigation.
      let couponPageData = null;
      let couponRefreshError = '';

      try {
        const [couponsResponse, statisticsResponse] =
          await Promise.all([
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

      try {
        await loadCouponBalance();
      } catch {
        // Balance refresh must not block navigation.
      }

      navigate('/booking-confirmation', {
        state: {
          booking: confirmedBooking,
          couponPageData,
          couponRefreshError
        },
        replace: true
      });
    } catch (err) {
      console.error('Booking error:', err);
      console.error('Backend response:', err.response?.data);

      setBookingError(
        err.response?.data?.message ||
        err.message ||
        'Booking failed. Please try again.'
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (!flight) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Plane size={42} color="#0284c7" />
        <h2>No flight selected</h2>
        <p>Please search for a flight before booking.</p>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={() => navigate('/availability')}
        >
          Search Flights
        </button>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        color: '#0f172a'
      }}
    >
      <style>{`
        .booking-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr);
          gap: 24px;
          align-items: start;
        }

        .booking-two-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .booking-three-fields {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .booking-seat {
          padding: 7px 10px;
          border-radius: 7px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          cursor: pointer;
          font-weight: 600;
        }

        .booking-seat:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        @media (max-width: 990px) {
          .booking-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 600px) {
          .booking-two-fields,
          .booking-three-fields {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#64748b',
            fontSize: '0.85rem',
            marginBottom: 8
          }}
        >
          <span>Flights</span>
          <ChevronRight size={14} />
          <span style={{ color: '#0284c7', fontWeight: 700 }}>
            Booking Checkout
          </span>
        </div>

        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: 0 }}>
          Complete Flight Reservation
        </h1>
      </div>

      {bookingError && (
        <div role="alert" style={styles.error}>
          <AlertCircle
            size={18}
            style={{ verticalAlign: 'middle', marginRight: 8 }}
          />
          {bookingError}
        </div>
      )}

      <div className="booking-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Flight details */}
          <section style={styles.card}>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                marginBottom: 18
              }}
            >
              <Plane size={28} color="#0284c7" />
              <div>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                  {flight.airline}
                </h2>
                <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
                  Flight #{flight.flightNumber}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                borderRadius: 12,
                background: '#f8fafc'
              }}
            >
              <div>
                <strong style={{ fontSize: '1.2rem' }}>
                  {flight.departureTime}
                </strong>
                <div>{flight.fromCity}</div>
                <small style={{ color: '#64748b' }}>
                  {flight.departureDate}
                </small>
              </div>

              <div style={{ textAlign: 'center', color: '#64748b' }}>
                <Clock size={15} />
                <div style={{ fontSize: '0.8rem' }}>
                  {flight.duration}
                </div>
                <div style={{ marginTop: 6 }}>
                  {flight.distanceKm
                    ? `${flight.distanceKm} km`
                    : 'Distance unavailable'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '1.2rem' }}>
                  {flight.arrivalTime}
                </strong>
                <div>{flight.toCity}</div>
                <small style={{ color: '#64748b' }}>
                  {flight.arrivalDate}
                </small>
              </div>
            </div>
          </section>

          {/* Passenger form */}
          <section style={styles.card}>
            <h2 style={{ fontSize: '1.15rem', marginTop: 0 }}>
              Passenger Details
            </h2>

            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Add details for all {passengerCount} passenger(s).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {passengers.map((passenger, index) => {
                const errors = formErrors[index] || {};
                const selectedSeat = passenger.seat.trim().toUpperCase();

                return (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: 16
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 16
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>
                        <User
                          size={17}
                          style={{ verticalAlign: 'middle', marginRight: 6 }}
                        />
                        Passenger {index + 1}
                      </h3>

                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removePassenger(index)}
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <FormField
                        label="Full Name *"
                        value={passenger.name}
                        placeholder="Enter passenger name"
                        error={errors.name}
                        onChange={(e) =>
                          updatePassenger(index, 'name', e.target.value)
                        }
                      />
                    </div>

                    <div className="booking-two-fields" style={{ marginBottom: 14 }}>
                      <FormField
                        label="Email Address *"
                        type="email"
                        value={passenger.email}
                        placeholder="Enter email"
                        error={errors.email}
                        onChange={(e) =>
                          updatePassenger(index, 'email', e.target.value)
                        }
                      />

                      <FormField
                        label="Phone Number *"
                        type="tel"
                        value={passenger.phone}
                        placeholder="+91 98765 43210"
                        error={errors.phone}
                        onChange={(e) =>
                          updatePassenger(index, 'phone', e.target.value)
                        }
                      />
                    </div>

                    <div className="booking-three-fields">
                      <FormField
                        label="Age *"
                        type="number"
                        min="1"
                        max="120"
                        value={passenger.age}
                        placeholder="Age"
                        error={errors.age}
                        onChange={(e) =>
                          updatePassenger(index, 'age', e.target.value)
                        }
                      />

                      <FormField
                        label="Gender *"
                        value={passenger.gender}
                        options={['Male', 'Female', 'Other']}
                        error={errors.gender}
                        onChange={(e) =>
                          updatePassenger(index, 'gender', e.target.value)
                        }
                      />

                      <FormField
                        label="Seat (Optional)"
                        value={passenger.seat}
                        placeholder="e.g. 14B"
                        error={errors.seat}
                        onChange={(e) =>
                          updatePassenger(
                            index,
                            'seat',
                            e.target.value.toUpperCase()
                          )
                        }
                      />
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          marginBottom: 8,
                          color: '#475569'
                        }}
                      >
                        Select a sample seat
                      </span>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6
                        }}
                      >
                        {SAMPLE_SEATS.map((seat) => {
                          const takenByOther = passengers.some(
                            (other, otherIndex) =>
                              otherIndex !== index &&
                              other.seat.trim().toUpperCase() === seat
                          );

                          const selected = selectedSeat === seat;

                          return (
                            <button
                              type="button"
                              key={seat}
                              disabled={takenByOther}
                              className="booking-seat"
                              onClick={() =>
                                updatePassenger(index, 'seat', seat)
                              }
                              style={{
                                borderColor: selected ? '#0284c7' : '#cbd5e1',
                                background: selected ? '#e0f2fe' : '#f8fafc',
                                color: selected ? '#0369a1' : '#334155'
                              }}
                            >
                              {seat}
                            </button>
                          );
                        })}
                      </div>

                      <small style={{ color: '#64748b' }}>
                        Sample seats only. Actual seat availability must be
                        verified by the backend.
                      </small>
                    </div>
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

            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>
                Payment Method
              </h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 10
                }}
              >
                {PAYMENT_METHODS.map((method) => (
                  <button
                    type="button"
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    aria-pressed={paymentMethod === method}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: paymentMethod === method
                        ? '2px solid #0284c7'
                        : '1px solid #e2e8f0',
                      background: paymentMethod === method ? '#f0f9ff' : '#fff',
                      color: paymentMethod === method ? '#0369a1' : '#475569',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <CreditCard size={19} />
                    <div style={{ marginTop: 6, fontSize: '0.8rem' }}>
                      {method}
                    </div>
                  </button>
                ))}
              </div>
              <small style={{ color: '#64748b' }}>
                This is a simulated payment selection, not a real payment gateway.
              </small>
            </div>
          </section>
        </div>

        {/* Coupons and fare summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={styles.card}>
            <h2
              style={{
                fontSize: '1.1rem',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 0
              }}
            >
              <Tag size={20} color="#0284c7" />
              Apply Promo Coupon
            </h2>

            <div
              style={{
                padding: 14,
                background: '#f0f9ff',
                borderRadius: 10,
                marginBottom: 16
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <span>Available points</span>
                <strong>{availableCouponPoints.toLocaleString('en-IN')}</strong>
              </div>

              <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#475569' }}>
                Discount value (10 points = ₹1):{' '}
                {formatINR(
                  Number(couponBalance?.availableDiscountAmount) || 0
                )}
              </div>

              {couponBalanceError && (
                <p style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                  {couponBalanceError}
                </p>
              )}

              <button
                type="button"
                disabled={availableCouponPoints <= 0 || !!appliedCoupon}
                onClick={() => setRedeemCouponPoints((value) => !value)}
                style={{
                  marginTop: 12,
                  ...styles.primaryButton,
                  width: 'auto',
                  opacity:
                    availableCouponPoints <= 0 || appliedCoupon ? 0.5 : 1
                }}
              >
                {redeemCouponPoints
                  ? `Remove Points Discount (${formatINR(pointsDiscountAmount)})`
                  : `Apply Points - Save ${formatINR(availablePointsDiscount)}`}
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyCoupon();
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  style={{ ...styles.input, minWidth: 0, flex: 1 }}
                />

                <button
                  type="submit"
                  disabled={couponLoading}
                  style={{
                    ...styles.primaryButton,
                    width: 'auto',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {couponLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>
            </form>

            {couponSuccess && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: '#ecfdf5',
                  color: '#047857',
                  borderRadius: 8,
                  fontSize: '0.82rem'
                }}
              >
                <CheckCircle size={15} style={{ verticalAlign: 'middle' }} />{' '}
                {couponSuccess}
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  style={{
                    display: 'block',
                    marginTop: 8,
                    border: 0,
                    color: '#dc2626',
                    background: 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  Remove coupon
                </button>
              </div>
            )}

            {couponError && (
              <p role="alert" style={{ color: '#dc2626', fontSize: '0.82rem' }}>
                {couponError}
              </p>
            )}

            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 18, paddingTop: 16 }}>
              <h3 style={{ fontSize: '0.95rem' }}>Available Coupons</h3>

              {couponsLoading && (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Loading coupons...
                </p>
              )}

              {couponsError && (
                <p style={{ color: '#dc2626', fontSize: '0.82rem' }}>
                  {couponsError}
                </p>
              )}

              {!couponsLoading && !couponsError && passengerCoupons.length === 0 && (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  No available coupons.
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {passengerCoupons.map((coupon) => (
                  <div
                    key={coupon.couponId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '0.85rem' }}>
                        {coupon.couponCode}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                        {formatINR(
                          Number(coupon.discountAmount ?? coupon.discountValue) || 0
                        )} off
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={couponLoading}
                      onClick={() => handleApplyCoupon(coupon.couponCode)}
                      style={{
                        ...styles.primaryButton,
                        width: 'auto',
                        padding: '8px 12px',
                        fontSize: '0.8rem'
                      }}
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>
              Fare Breakdown
            </h2>

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
                  Total fare ({passengerCount} passenger(s))
                </span>
                <strong>
                  {fareAvailable ? formatINR(originalFare) : 'Unavailable'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#059669' }}>
                <span>
                  Coupon discount
                  {appliedCoupon ? ` (${appliedCoupon.couponCode})` : ''}
                </span>
                <strong>-{formatINR(discountAmount)}</strong>
              </div>

              {redeemCouponPoints && !appliedCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: '#059669' }}>
                  <span>Points discount</span>
                  <strong>-{formatINR(pointsDiscountAmount)}</strong>
                </div>
              )}

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
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
                  Confirm Booking ({formatINR(totalAmount)})
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: '#64748b',
                fontSize: '0.75rem',
                marginTop: 14
              }}
            >
              <ShieldCheck size={15} color="#059669" />
              <span>Booking confirmation after successful API response</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
