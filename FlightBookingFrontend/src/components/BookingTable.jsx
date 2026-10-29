import React, { useState } from 'react';
import { Eye, XCircle, Download, FileText, CalendarClock, Edit3, X } from 'lucide-react';
import { formatINR } from '../utils/flightPricing';

const STATUS_BADGES = {
  Confirmed: 'badge-confirmed',
  Cancelled: 'badge-cancelled',
  Rescheduled: 'badge-rescheduled',
  Failed: 'badge-failed',
};

// Confirmed and Rescheduled bookings are active tickets; Cancelled and Failed ones are final.
const isActiveBooking = (b) => {
  const status = String(b?.bookingStatus || '').toLowerCase();
  return status === 'confirmed' || status === 'rescheduled';
};

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

export default function BookingTable({ bookings, onView, onCancel, onDownload, onReschedule }) {
  const [editTarget, setEditTarget] = useState(null);

  if (!bookings || bookings.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0'
        }}
      >
        <FileText size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155' }}>No Bookings Found</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px' }}>
          You haven't made any flight bookings yet. Explore available flights to get started!
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
      }}
    >
      <div style={{ overflowX: 'auto' }} className="ac-list-scroll">
        <table className='ac-flights-table' style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Booking ID</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Flight</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Route</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Departure</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Passenger</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Seat & Class</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Amount</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Status</th>
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr
                key={b.bookingId}
                style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Reference */}
                <td style={{ padding: '16px 18px', fontWeight: 700, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>
                  {b.bookingReference}
                </td>

                {/* Flight & Airline */}
                <td style={{ padding: '16px 18px' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.flightNumber}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{b.airline}</div>
                </td>

                {/* Route */}
                <td style={{ padding: '16px 18px' }}>
                  <div style={{ fontWeight: 500, color: '#334155' }}>
                    {b.fromCity} <span style={{ color: '#0284c7' }}>→</span> {b.toCity}
                  </div>
                </td>

                {/* Departure */}
                <td style={{ padding: '16px 18px' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.departureTime}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.departureDate}</div>
                </td>

                {/* Passenger */}
                <td style={{ padding: '16px 18px' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.passengerName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.passengerEmail}</div>
                </td>

                {/* Seat & Class */}
                <td style={{ padding: '16px 18px' }}>
                  <span style={{
                    fontWeight: 600, color: '#0f172a', padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#d5d5d5',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: '#0f172a',
                  }}>{b.seatNumber}</span>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.class}</div>
                </td>

                {/* Amount */}
                <td style={{ padding: '16px 18px', fontWeight: 700, color: '#0f172a' }}>
                  {formatINR(b.finalAmount ?? b.ticketPrice)}
                  {b.discountAmount > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                      Saved {formatINR(b.discountAmount)}
                    </div>
                  )}
                </td>

                {/* Status */}
                <td style={{ padding: '16px 18px', textAlign: 'center' }}>
                  <span className={`badge ${STATUS_BADGES[b.bookingStatus] || 'badge-pending'}`}>
                    {b.bookingStatus}
                  </span>
                </td>



                {/* Actions */}
                <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      onClick={() => onView(b)}
                      title="View Details"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#f0f9ff',
                        color: '#0284c7',
                        border: '1px solid #bae6fd',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}
                    >
                      <Eye size={14} />
                      <span>View</span>
                    </button>

                    {b.bookingStatus !== 'Failed' && (
                      <button
                        onClick={() => onDownload(b)}
                        title="Download Ticket"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600
                        }}
                      >
                        <Download size={14} />
                        <span>Ticket</span>
                      </button>
                    )}

                    <button
                      onClick={() => setEditTarget(b)}  
                      disabled={!isActiveBooking(b)}
                      title={isActiveBooking(b) ? 'Edit Booking (Reschedule or Cancel)' : `Cannot edit ${b.bookingStatus?.toLowerCase()} booking`}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: isActiveBooking(b) ? '#f8fafc' : '#f1f5f9',
                        color: isActiveBooking(b) ? '#0284c7' : '#94a3b8',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: isActiveBooking(b) ? 'pointer' : 'not-allowed',
                        opacity: isActiveBooking(b) ? 1 : 0.6
                      }}
                    >
                      <Edit3 size={14} />
                      <span>Edit</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Booking Popup (Rescheduled or Cancelled) */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  Edit Booking
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                  Reference: <strong style={{ color: '#0284c7', fontFamily: 'var(--font-mono)' }}>{editTarget.bookingReference}</strong>
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Route: {editTarget.fromCity} → {editTarget.toCity} ({editTarget.departureDate})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                style={{
                  border: 0,
                  background: '#f1f5f9',
                  borderRadius: '10px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.4 }}>
              Choose an action for this booking:
            </p>

            {/* Action Buttons: Only Rescheduled and Cancelled */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Option 1: Reschedule */}
              <button
                type="button"
                onClick={() => {
                  const targetBooking = editTarget;
                  setEditTarget(null);
                  if (onReschedule) onReschedule(targetBooking);
                }}
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#f5f3ff',
                  border: '1.5px solid #ddd6fe',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.backgroundColor = '#ede9fe'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#ddd6fe'; e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #ddd6fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CalendarClock size={22} color="#7c3aed" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#6d28d9' }}>
                    Reschedule
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#7c3aed', marginTop: '2px' }}>
                    View full booking details and choose a new flight
                  </div>
                </div>
              </button>

              {/* Option 2: Cancelled */}
              <button
                type="button"
                onClick={() => {
                  const targetId = editTarget.bookingId;
                  setEditTarget(null);
                  if (onCancel) onCancel(targetId);
                }}
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.backgroundColor = '#fef2f2'; }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <XCircle size={22} color="#dc2626" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#b91c1c' }}>
                    Cancelled
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '2px' }}>
                    Cancel this ticket and release your seat
                  </div>
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
