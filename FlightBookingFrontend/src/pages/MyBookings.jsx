import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, RefreshCw, AlertCircle, CheckCircle2, PlaneTakeoff, Search } from 'lucide-react';
import { bookingApi, flightApi } from '../services/api';
import BookingTable from '../components/BookingTable';

const STATUS_FILTERS = ['All', 'Confirmed', 'Rescheduled', 'Cancelled', 'Failed'];

const todayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export default function MyBookings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.includes(initialStatus) ? initialStatus : 'All');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Reschedule dialog state
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [flightOptions, setFlightOptions] = useState([]);
  const [flightOptionsLoading, setFlightOptionsLoading] = useState(false);
  const [selectedFlightId, setSelectedFlightId] = useState('');
  const [rescheduleSeat, setRescheduleSeat] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await bookingApi.getMyBookings();
      setBookings(res.data);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to fetch your bookings. Please ensure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleView = (booking) => {
    navigate('/booking-confirmation', { state: { booking } });
  };

  const handleDownload = (booking) => {
    navigate('/booking-confirmation', { state: { booking } });
  };

  const handleCancel = async (bookingId) => {
    const confirmed = window.confirm('Are you sure you want to cancel this flight booking? This will release your seat.');
    if (!confirmed) return;

    try {
      const res = await bookingApi.cancel(bookingId);
      setMessage(res.data?.message || 'Booking cancelled successfully.');
      setTimeout(() => setMessage(''), 4000);
      fetchBookings();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to cancel booking.';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const closeReschedule = () => {
    if (rescheduling) return;
    setRescheduleTarget(null);
    setFlightOptions([]);
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
    setFlightOptionsLoading(true);
    try {
      const res = await flightApi.getByRoute(booking.fromCity, booking.toCity);
      const today = todayIso();
      setFlightOptions(
        res.data.filter(
          (f) =>
            f.flightId !== booking.flightId &&
            f.availableSeats > 0 &&
            String(f.status).toLowerCase() === 'scheduled' &&
            String(f.departureDate) >= today
        )
      );
    } catch (err) {
      console.error(err);
      setRescheduleError(err.response?.data?.message || 'Unable to load flights for this route.');
    } finally {
      setFlightOptionsLoading(false);
    }
  };

  const submitReschedule = async () => {
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
    try {
      const res = await bookingApi.reschedule(rescheduleTarget.bookingId, {
        newFlightId: Number(selectedFlightId),
        seatNumber: rescheduleSeat.trim(),
      });
      setRescheduling(false);
      setRescheduleTarget(null);
      setFlightOptions([]);
      setMessage(res.data?.message || 'Booking rescheduled successfully.');
      setTimeout(() => setMessage(''), 4000);
      fetchBookings();
    } catch (err) {
      setRescheduling(false);
      setRescheduleError(err.response?.data?.message || 'Failed to reschedule booking.');
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'All' && b.bookingStatus !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchRef = b.bookingReference?.toLowerCase().includes(term);
      const matchPassenger = b.passengerName?.toLowerCase().includes(term);
      const matchRoute = `${b.fromCity} ${b.toCity}`.toLowerCase().includes(term);
      const matchFlight = b.flightNumber?.toLowerCase().includes(term);
      return matchRef || matchPassenger || matchRoute || matchFlight;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            My Flight Bookings
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginTop: '4px' }}>
            Manage, review, print, reschedule, and cancel your airline itineraries
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
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
              gap: '8px'
            }}
          >
            <PlaneTakeoff size={16} />
            <span>Book New Flight</span>
          </button>
          <button
            onClick={fetchBookings}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155'
            }}
            title="Refresh bookings"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div style={{ padding: '14px 18px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', color: '#065f46', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} color="#059669" />
          <span>{message}</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ padding: '14px 18px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} color="#dc2626" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search booking reference or route..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              backgroundColor: '#ffffff',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
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
                backgroundColor: statusFilter === status ? '#ffffff' : 'transparent',
                color: statusFilter === status ? '#0284c7' : '#64748b',
                boxShadow: statusFilter === status ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} color="#0284c7" className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b' }}>Loading your reservations from SQL Server...</p>
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
      {/* Reschedule dialog */}
      {rescheduleTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reschedule booking"
          onClick={closeReschedule}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#ffffff', borderRadius: '18px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Reschedule booking</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              {rescheduleTarget.bookingReference} · {rescheduleTarget.fromCity} → {rescheduleTarget.toCity} (currently {rescheduleTarget.flightNumber}, {rescheduleTarget.departureDate})
            </p>

            {rescheduleError && (
              <div role="alert" style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.85rem' }}>
                {rescheduleError}
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                New flight on the same route
              </label>
              {flightOptionsLoading ? (
                <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Loading available flights...</p>
              ) : flightOptions.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.88rem' }}>No other upcoming flights with free seats are available on this route.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {flightOptions.map((f) => (
                    <label
                      key={f.flightId}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: String(selectedFlightId) === String(f.flightId) ? '2px solid #7c3aed' : '1px solid #e2e8f0', backgroundColor: String(selectedFlightId) === String(f.flightId) ? '#f5f3ff' : '#f8fafc' }}
                    >
                      <input
                        type="radio"
                        name="reschedule-flight"
                        value={f.flightId}
                        checked={String(selectedFlightId) === String(f.flightId)}
                        onChange={() => setSelectedFlightId(String(f.flightId))}
                      />
                      <div style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                        <div style={{ fontWeight: 700 }}>{f.airline} · {f.flightNumber}</div>
                        <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                          {f.departureDate} · {f.departureTime} → {f.arrivalTime} · {f.availableSeats} seats left
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px' }}>
              <label htmlFor="reschedule-seat" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Seat number
              </label>
              <input
                id="reschedule-seat"
                type="text"
                value={rescheduleSeat}
                onChange={(e) => setRescheduleSeat(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                The fare stays the same because the route is unchanged.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
              <button
                type="button"
                onClick={closeReschedule}
                disabled={rescheduling}
                style={{ padding: '10px 16px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, fontSize: '0.88rem' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitReschedule}                
                style={{ padding: '10px 18px', borderRadius: '10px', backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 700, fontSize: '0.88rem', opacity: rescheduling || flightOptions.length === 0 ? 0.6 : 1 }}
              >
                {rescheduling ? 'Rescheduling...' : 'Confirm reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
