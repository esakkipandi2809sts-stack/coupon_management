import React from 'react';
import { Eye, Download, CalendarClock, XCircle } from 'lucide-react';

const STATUS_BADGES = {
  Confirmed: 'badge-confirmed',
  Rescheduled: 'badge-rescheduled',
  Cancelled: 'badge-cancelled',
  Failed: 'badge-failed',
};

const formatINR = (amount) => {
  if (amount === null || amount === undefined || amount === '') return '—';
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return String(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

const isActiveBooking = (booking) => {
  const status = String(booking.bookingStatus ?? '').toLowerCase();
  const departureDate = String(booking.departureDate ?? '').slice(0, 10);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return !['cancelled', 'failed'].includes(status) && departureDate >= today;
};

export default function BookingTable({ bookings = [], onView, onCancel, onReschedule, onDownload }) {
  if (!bookings.length) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#ffffff' }}>
        <p style={{ color: '#334155', fontWeight: 700, margin: 0 }}>No bookings found</p>
        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '8px 0 0' }}>Try changing your search or status filter.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 'min(60vh, 560px)', maxHeight: '560px', overflowX: 'auto', overflowY: 'auto', overscrollBehavior: 'contain', border: '1px solid #e2e8f0', borderRadius: '14px', background: '#ffffff' }}>
      <table style={{ width: '100%', minWidth: '1120px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'center' }}>
        <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
          <tr>
            {['Booking ID', 'Booking Date', 'Flight & Airline', 'Route', 'Departure', 'Passenger', 'Seat & Class', 'Amount', 'Status', 'Actions'].map((heading) => (
              <th key={heading} scope="col" style={{ padding: '14px 18px', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, whiteSpace: 'nowrap' }}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.bookingId} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}>
              {/* Reference */}
              <td style={{ padding: '16px 18px', fontWeight: 700, color: '#0284c7', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{b.bookingReference || '—'}</td>
              
              <td style={{ padding: '16px 18px' }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.bookingDate ? String(b.bookingDate).slice(0, 10) : '—'}</div>
              </td>
              {/* Flight & Airline */}
              <td style={{ padding: '16px 18px' }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.flightNumber || '—'}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{b.airline || '—'}</div>
              </td>

              {/* Route */}
              <td style={{ padding: '16px 18px' }}>
                <div style={{ fontWeight: 500, color: '#334155', whiteSpace: 'nowrap' }}>{b.fromCity} <span style={{ color: '#0284c7' }}>→</span> {b.toCity}</div>
              </td>

              {/* Departure */}
              <td style={{ padding: '16px 18px', }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.departureTime || '—'}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.departureDate || '—'}</div>
              </td>

              {/* Passenger */}
              <td style={{ padding: '16px 18px' }}><div style={{ fontWeight: 600, color: '#0f172a' }}>{b.passengerName || '—'}</div></td>

              {/* Seat & Class */}
              <td style={{ padding: '16px 18px', }}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#f1f5f9', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#0f172a', marginRight: '6px' }}>{b.seatNumber || '—'}</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.class || '—'}</span>
              </td>

              {/* Amount */}
              <td style={{ padding: '16px 18px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                {formatINR(b.finalAmount ?? b.ticketPrice)}
                {Number(b.discountAmount) > 0 && <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Saved {formatINR(b.discountAmount)}</div>}
              </td>

              {/* Status */}
              <td style={{ padding: '16px 18px' }}>
                <span className={`badge ${STATUS_BADGES[b.bookingStatus] || 'badge-pending'}`}>{b.bookingStatus || 'Pending'}</span>
              </td>

              {/* Actions */}
              <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={() => onView?.(b)} title="View Details" style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                    <Eye size={14} /><span>View</span>
                  </button>

                  {b.bookingStatus !== 'Failed' && (
                    <button type="button" onClick={() => onDownload?.(b)} title="Download Ticket" style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      <Download size={14} /><span>Ticket</span>
                    </button>
                  )}

                  {isActiveBooking(b) && onReschedule && (
                    <button type="button" onClick={() => onReschedule(b)} title="Reschedule Booking" style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      <CalendarClock size={14} /><span>Reschedule</span>
                    </button>
                  )}

                  {isActiveBooking(b) && (
                    <button type="button" onClick={() => onCancel?.(b.bookingId)} title="Cancel Booking" style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      <XCircle size={14} /><span>Cancel</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
