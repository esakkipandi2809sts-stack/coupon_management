
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  PlaneTakeoff,
  Search,
  X,
  Plane,
  Clock3,
  UserRound,
  Armchair,
  IndianRupee,
} from 'lucide-react';
import { bookingApi, flightApi } from '../services/api';
import BookingTable from '../components/BookingTable';

const STATUS_FILTERS = [
  'All',
  'Confirmed',
  'Rescheduled',
  'Cancelled',
  'Failed',
];

const todayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
};

const dateOnly = (value) => String(value ?? '').slice(0, 10);

export default function MyBookings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    STATUS_FILTERS.includes(initialStatus) ? initialStatus : 'All'
  );
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Reschedule dialog state
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [flightOptions, setFlightOptions] = useState([]);
  const [flightOptionsLoading, setFlightOptionsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedFlightId, setSelectedFlightId] = useState('');
  const [rescheduleSeat, setRescheduleSeat] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await bookingApi.getMyBookings();
      setBookings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setErrorMessage(
        'Failed to fetch your bookings. Please ensure you are logged in.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    // Fetch once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleView = (booking) => {
    navigate('/booking-confirmation', { state: { booking } });
  };

  const handleDownload = (booking) => {
    navigate('/booking-confirmation', { state: { booking } });
  };

  const handleCancel = async (bookingId) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this flight booking? This will release your seat.'
    );

    if (!confirmed) return;

    setMessage('');
    setErrorMessage('');

    try {
      const res = await bookingApi.cancel(bookingId);

      setMessage(res.data?.message || 'Booking cancelled successfully.');
      window.setTimeout(() => setMessage(''), 4000);

      await fetchBookings();
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Failed to cancel booking.';

      setErrorMessage(msg);
      window.setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const closeReschedule = () => {
    if (rescheduling) return;

    setRescheduleTarget(null);
    setFlightOptions([]);
    setSelectedDate(todayIso());
    setSelectedFlightId('');
    setRescheduleSeat('');
    setRescheduleError('');
  };

  const handleReschedule = async (booking) => {
    setRescheduleTarget(booking);
    setSelectedFlightId('');
    setRescheduleSeat(booking.seatNumber || '');
    setRescheduleError('');
    setFlightOptions([]);
    setSelectedDate(todayIso());
    setFlightOptionsLoading(true);

    try {
      const res = await flightApi.getByRoute(
        booking.fromCity,
        booking.toCity
      );

      const today = todayIso();

      const availableFlights = (Array.isArray(res.data) ? res.data : [])
        .filter(
          (flight) =>
            String(flight.flightId) !== String(booking.flightId) &&
            Number(flight.availableSeats) > 0 &&
            String(flight.status).toLowerCase() === 'scheduled' &&
            dateOnly(flight.departureDate) >= today
        )
        .sort((a, b) => {
          const dateCompare = dateOnly(a.departureDate).localeCompare(
            dateOnly(b.departureDate)
          );

          return (
            dateCompare ||
            String(a.departureTime ?? '').localeCompare(
              String(b.departureTime ?? '')
            )
          );
        });

      setFlightOptions(availableFlights);

      if (availableFlights.length > 0) {
        setSelectedDate(dateOnly(availableFlights[0].departureDate));
      }
    } catch (err) {
      console.error('Failed to load reschedule flights:', err);

      setRescheduleError(
        err.response?.data?.message ||
        'Unable to load flights for this route.'
      );
    } finally {
      setFlightOptionsLoading(false);
    }
  };

  const flightsForSelectedDate = useMemo(
    () =>
      flightOptions.filter(
        (flight) => dateOnly(flight.departureDate) === selectedDate
      ),
    [flightOptions, selectedDate]
  );

  useEffect(() => {
    if (
      selectedFlightId &&
      !flightsForSelectedDate.some(
        (flight) => String(flight.flightId) === String(selectedFlightId)
      )
    ) {
      setSelectedFlightId('');
    }
  }, [selectedDate, selectedFlightId, flightsForSelectedDate]);

  // Confirm reschedule and show success alert
  const submitReschedule = async () => {
    if (!rescheduleTarget) {
      setRescheduleError('Please select a booking to reschedule.');
      return;
    }

    if (!selectedFlightId) {
      setRescheduleError('Please choose the flight you want to move to.');
      return;
    }

    if (!rescheduleSeat.trim()) {
      setRescheduleError('Please enter a seat number.');
      return;
    }

    setRescheduling(true);
    setRescheduleError('');
    setMessage('');
    setErrorMessage('');

    try {
      const res = await bookingApi.reschedule(
        rescheduleTarget.bookingId,
        {
          newFlightId: Number(selectedFlightId),
          seatNumber: rescheduleSeat.trim().toUpperCase(),
        }
      );

      // Show success alert only after the API request succeeds.
      window.alert(
        res.data?.message || 'Rescheduled successfully!'
      );

      setMessage(
        res.data?.message || 'Booking rescheduled successfully.'
      );

      setRescheduleTarget(null);
      setFlightOptions([]);
      setSelectedDate(todayIso());
      setSelectedFlightId('');
      setRescheduleSeat('');
      setRescheduleError('');

      await fetchBookings();
    } catch (err) {
      console.error('Failed to reschedule booking:', err);

      setRescheduleError(
        err.response?.data?.message ||
        'Failed to reschedule booking. Please try again.'
      );
    } finally {
      setRescheduling(false);
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (
      statusFilter !== 'All' &&
      booking.bookingStatus?.toLowerCase() !== statusFilter.toLowerCase()
    ) {
      return false;
    }
    // Exclude pending bookings from display
    if (booking.bookingStatus?.toLowerCase() === 'pending') {
      return false;
    }

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();

    const matchRef = booking.bookingReference
      ?.toLowerCase()
      .includes(term);

    const matchPassenger = booking.passengerName
      ?.toLowerCase()
      .includes(term);

    const matchRoute = `${booking.fromCity ?? ''} ${booking.toCity ?? ''
      }`
      .toLowerCase()
      .includes(term);

    const matchFlight = booking.flightNumber
      ?.toLowerCase()
      .includes(term);

    return Boolean(
      matchRef || matchPassenger || matchRoute || matchFlight
    );
  });

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            My Flight Bookings
          </h1>

          <p
            style={{
              color: '#64748b',
              fontSize: '0.92rem',
              marginTop: '4px',
              marginBottom: 0,
            }}
          >
            Manage, review, print, reschedule, and cancel your airline
            itineraries
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate('/availability')}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 0,
              cursor: 'pointer',
            }}
          >
            <PlaneTakeoff size={16} />
            <span>Book New Flight</span>
          </button>

          <button
            type="button"
            onClick={fetchBookings}
            title="Refresh bookings"
            disabled={loading}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {/* Success message */}
      {message && (
        <div
          role="status"
          style={{
            padding: '14px 18px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            color: '#065f46',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <CheckCircle2 size={18} color="#059669" />
          <span>{message}</span>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '14px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#991b1b',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} color="#dc2626" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 'min(320px, 100%)',
          }}
        >
          <Search
            size={18}
            color="#94a3b8"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />

          <input
            type="text"
            placeholder="Search booking reference or route..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 14px 9px 38px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              backgroundColor: '#ffffff',
              outline: 'none',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '12px',
            flexWrap: 'wrap',
          }}
        >
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                backgroundColor:
                  statusFilter === status ? '#ffffff' : 'transparent',
                color:
                  statusFilter === status ? '#0284c7' : '#64748b',
                boxShadow:
                  statusFilter === status
                    ? '0 1px 4px rgba(0,0,0,0.06)'
                    : 'none',
                border: 0,
                cursor: 'pointer',
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw
            size={36}
            color="#0284c7"
            className="animate-spin"
            style={{ margin: '0 auto 12px' }}
          />
          <p style={{ color: '#64748b' }}>
            Loading your reservations from SQL Server...
          </p>
        </div>
      ) : (
        <BookingTable
          bookings={filteredBookings}
          onView={handleView}
          onCancel={handleCancel}
          onReschedule={handleReschedule}
          onDownload={handleDownload}
        />
      )}

      {/* Reschedule Dialog */}
      {rescheduleTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reschedule booking"
          onClick={closeReschedule}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.58)',
            display: 'flex',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '80vh',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
              boxSizing: 'border-box',
              margin: 'auto',
            }}
          >
            {/* Dialog Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#7c3aed',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  <CalendarCheck size={16} />
                  Manage itinerary
                </div>

                <h2
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: '8px 0 4px',
                  }}
                >
                  Reschedule booking
                </h2>

                <p
                  style={{
                    fontSize: '0.84rem',
                    color: '#64748b',
                    margin: 0,
                  }}
                >
                  Booking reference:{' '}
                  <strong>{rescheduleTarget.bookingReference}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={closeReschedule}
                disabled={rescheduling}
                aria-label="Close dialog"
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#64748b',
                  borderRadius: '10px',
                  padding: '8px',
                  cursor: rescheduling ? 'not-allowed' : 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Booking Summary */}
            <div
              style={{
                marginTop: '18px',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                background: 'linear-gradient(135deg, #f8fafc, #f5f3ff)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    color: '#64748b',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Current flight
                </span>

                <span
                  style={{
                    background: '#ede9fe',
                    color: '#6d28d9',
                    padding: '5px 9px',
                    borderRadius: '999px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                  }}
                >
                  {rescheduleTarget.flightNumber}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '14px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    {rescheduleTarget.fromCity}
                  </div>

                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    {rescheduleTarget.departureDate}
                  </div>

                  <div
                    style={{
                      color: '#334155',
                      fontWeight: 700,
                      marginTop: '3px',
                    }}
                  >
                    {rescheduleTarget.departureTime}
                  </div>
                </div>

                <Plane size={20} color="#7c3aed" />

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    {rescheduleTarget.toCity}
                  </div>

                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    Destination
                  </div>

                  <div
                    style={{
                      color: '#334155',
                      fontWeight: 700,
                      marginTop: '3px',
                    }}
                  >
                    {rescheduleTarget.arrivalTime || '—'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '14px',
                  flexWrap: 'wrap',
                  borderTop: '1px solid #e2e8f0',
                  marginTop: '14px',
                  paddingTop: '12px',
                  color: '#475569',
                  fontSize: '0.8rem',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <UserRound size={14} />
                  {rescheduleTarget.passengerName || 'Passenger'}
                </span>

                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Armchair size={14} />
                  Seat {rescheduleTarget.seatNumber || '—'}
                </span>

                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <IndianRupee size={14} />
                  Fare remains the same
                </span>
              </div>
            </div>

            {/* Reschedule Error */}
            {rescheduleError && (
              <div
                role="alert"
                style={{
                  marginTop: '14px',
                  padding: '11px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <AlertCircle size={16} />
                {rescheduleError}
              </div>
            )}

            {/* Travel Date */}
            <div style={{ marginTop: '20px' }}>
              <label
                htmlFor="reschedule-date"
                style={{
                  display: 'block',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  color: '#334155',
                  marginBottom: '8px',
                }}
              >
                Choose your new travel date
              </label>

              <div style={{ position: 'relative' }}>
                <CalendarCheck
                  size={18}
                  color="#7c3aed"
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />

                <input
                  id="reschedule-date"
                  type="date"
                  min={todayIso()}
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedFlightId('');
                    setRescheduleError('');
                  }}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 12px 12px 40px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    background: '#fff',
                  }}
                />
              </div>
            </div>

            {/* Available Flights */}
            <div style={{ marginTop: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '10px',
                }}
              >
                <label
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: '#334155',
                  }}
                >
                  Available flights
                </label>

                <span style={{ color: '#64748b', fontSize: '0.76rem' }}>
                  {flightsForSelectedDate.length} option(s)
                </span>
              </div>

              {flightOptionsLoading ? (
                <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                  Loading available flights...
                </p>
              ) : flightOptions.length === 0 ? (
                <p
                  style={{
                    color: '#64748b',
                    fontSize: '0.88rem',
                    background: '#f8fafc',
                    padding: '14px',
                    borderRadius: '12px',
                  }}
                >
                  No other upcoming flights with free seats are available on
                  this route.
                </p>
              ) : flightsForSelectedDate.length === 0 ? (
                <p
                  style={{
                    color: '#64748b',
                    fontSize: '0.88rem',
                    background: '#f8fafc',
                    padding: '14px',
                    borderRadius: '12px',
                  }}
                >
                  No available flights on this date. Please choose another
                  date.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                  }}
                >
                  {flightsForSelectedDate.map((flight) => {
                    const isSelected =
                      String(selectedFlightId) === String(flight.flightId);

                    return (
                      <label
                        key={flight.flightId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '13px 14px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          border: isSelected
                            ? '2px solid #7c3aed'
                            : '1px solid #e2e8f0',
                          backgroundColor: isSelected
                            ? '#f5f3ff'
                            : '#ffffff',
                        }}
                      >
                        <input
                          type="radio"
                          name="reschedule-flight"
                          value={flight.flightId}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedFlightId(String(flight.flightId));
                            setRescheduleError('');
                          }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '10px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <strong
                              style={{
                                color: '#0f172a',
                                fontSize: '0.9rem',
                              }}
                            >
                              {flight.airline} · {flight.flightNumber}
                            </strong>

                            <span
                              style={{
                                color: '#047857',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                              }}
                            >
                              {flight.availableSeats} seats left
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: '#64748b',
                              fontSize: '0.8rem',
                              marginTop: '5px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <Clock3 size={14} />
                            {flight.departureTime} → {flight.arrivalTime}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Seat Number */}
            <div style={{ marginTop: '18px' }}>
              <label
                htmlFor="reschedule-seat"
                style={{
                  display: 'block',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  color: '#334155',
                  marginBottom: '8px',
                }}
              >
                Seat number
              </label>

              <input
                id="reschedule-seat"
                type="text"
                value={rescheduleSeat}
                onChange={(event) =>
                  setRescheduleSeat(event.target.value.toUpperCase())
                }
                placeholder="e.g. 12A"
                autoComplete="off"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                }}
              />

              <p
                style={{
                  fontSize: '0.76rem',
                  color: '#64748b',
                  marginTop: '7px',
                  marginBottom: 0,
                }}
              >
                The fare stays the same because the route is unchanged. Seat
                availability will be validated when you confirm.
              </p>
            </div>

            {/* Dialog Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={closeReschedule}
                disabled={rescheduling}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: rescheduling ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitReschedule}
                disabled={
                  rescheduling ||
                  flightOptionsLoading ||
                  !selectedFlightId ||
                  !rescheduleSeat.trim()
                }
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  border: 0,
                  cursor:
                    rescheduling ||
                      flightOptionsLoading ||
                      !selectedFlightId ||
                      !rescheduleSeat.trim()
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    rescheduling ||
                      flightOptionsLoading ||
                      !selectedFlightId ||
                      !rescheduleSeat.trim()
                      ? 0.6
                      : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <RefreshCw
                  size={15}
                  className={rescheduling ? 'animate-spin' : ''}
                />

                {rescheduling
                  ? 'Rescheduling...'
                  : 'Confirm reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
