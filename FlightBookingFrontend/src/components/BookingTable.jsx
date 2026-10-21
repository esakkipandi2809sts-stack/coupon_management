import React from 'react';
import { Eye, XCircle, Download, FileText, CalendarClock } from 'lucide-react';
import { formatINR } from '../utils/flightPricing';

const STATUS_BADGES = {
  Confirmed: 'badge-confirmed',
  Cancelled: 'badge-cancelled',
  Rescheduled: 'badge-rescheduled',
  Failed: 'badge-failed',
};

// Confirmed and Rescheduled bookings are active tickets; Cancelled and Failed ones are final.
const isActiveBooking = (b) => b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Rescheduled';

export default function BookingTable({ bookings, onView, onCancel, onDownload, onReschedule }) {
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
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
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
              <th style={{ padding: '14px 18px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
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
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#f1f5f9',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      color: '#0f172a',
                      marginRight: '6px'
                    }}
                  >
                    {b.seatNumber}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.class}</span>
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
                <td style={{ padding: '16px 18px', display: 'flex', justifyContent: 'flex-end',gap: '8px' }}>
                  <span className={`badge ${STATUS_BADGES[b.bookingStatus] || 'badge-pending'}`}>
                    {b.bookingStatus}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>


                    {isActiveBooking(b) && onReschedule && (
                      <button
                        onClick={() => onReschedule(b)}
                        title="Reschedule Booking"
                        className="badge-Reschedule"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#f5f3ff',
                          color: '#7c3aed',
                          border: '1px solid #ddd6fe',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600
                        }}
                      >
                        <CalendarClock size={14} />
                        <span>Reschedule</span>
                      </button>
                    )}

                    {isActiveBooking(b) && (
                      <button
                        onClick={() => onCancel(b.bookingId)}
                        title="Cancel Booking"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600
                        }}
                      >
                        <XCircle size={14} />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
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


                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
