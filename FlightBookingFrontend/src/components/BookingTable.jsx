
import React from 'react';
import { Eye, Download, CalendarClock, XCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  'Confirmed',
  'Rescheduled',
  'Cancelled',
  'Failed',
];

const STATUS_BADGES = {
  Confirmed: 'badge-confirmed',
  Rescheduled: 'badge-rescheduled',
  Cancelled: 'badge-cancelled',
  Failed: 'badge-failed',
};

const normalizeStatus = (status) =>
  String(status ?? '').trim().toLowerCase();

const getStatusClass = (status) => {
  const matchedStatus = STATUS_OPTIONS.find(
    (item) => normalizeStatus(item) === normalizeStatus(status)
  );

  return matchedStatus
    ? STATUS_BADGES[matchedStatus]
    : 'badge-pending';
};

const formatINR = (amount) => {
  if (amount === null || amount === undefined || amount === '') {
    return '—';
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return String(amount);
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

const isActiveBooking = (booking) => {
  const status = normalizeStatus(booking.bookingStatus);
  const departureDate = String(booking.departureDate ?? '').slice(0, 10);

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  return (
    !['cancelled', 'failed'].includes(status) &&
    departureDate !== '' &&
    departureDate >= today
  );
};

const buttonStyle = (active) => ({
  padding: '6px 10px',
  borderRadius: '8px',
  border: active ? '1px solid #0284c7' : '1px solid #e2e8f0',
  backgroundColor: active ? '#e0f2fe' : '#ffffff',
  color: active ? '#0369a1' : '#475569',
  fontSize: '0.72rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
});

export default function BookingTable({
  bookings = [],
  onView,
  onCancel,
  onReschedule,
  onDownload,
  selectedStatus = 'All',
  onStatusFilter,
}) {
  return (
    <div style={{ width: '100%' }}>
      {/* Clickable status filters - single horizontal row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '4px',
        }}
      >
        {['All', ...STATUS_OPTIONS].map((status) => {
          const active =
            normalizeStatus(selectedStatus) === normalizeStatus(status);

          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusFilter?.(status)}
              aria-pressed={active}
              style={buttonStyle(active)}
            >
              {status}
            </button>
          );
        })}
      </div>

      {!bookings.length ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            background: '#ffffff',
          }}
        >
          <p style={{ color: '#334155', fontWeight: 700, margin: 0 }}>
            No bookings found
          </p>

          <p
            style={{
              color: '#64748b',
              fontSize: '0.88rem',
              margin: '8px 0 0',
            }}
          >
            Try changing your search or status filter.
          </p>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: 'min(60vh, 560px)',
            maxHeight: '560px',
            overflowX: 'auto',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            background: '#ffffff',
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: '1120px',
              borderCollapse: 'separate',
              borderSpacing: 0,
              textAlign: 'center',
            }}
          >
            <thead
              style={{
                backgroundColor: '#f8fafc',
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}
            >
              <tr>
                {[
                  'Booking ID',
                  'Booking Date',
                  'Flight & Airline',
                  'Route',
                  'Departure',
                  'Passenger',
                  'Seat & Class',
                  'Amount',
                  'Status',
                  'Actions',
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    style={{
                      padding: '14px 18px',
                      color: '#64748b',
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {bookings.map((b) => {
                const status = String(
                  b.bookingStatus ?? 'Pending'
                ).trim();

                const normalizedStatus = normalizeStatus(status);

                return (
                  <tr
                    key={b.bookingId ?? b.bookingReference}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <td
                      style={{
                        padding: '16px 18px',
                        fontWeight: 700,
                        color: '#0284c7',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {b.bookingReference || '—'}
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {b.bookingDate
                          ? String(b.bookingDate).slice(0, 10)
                          : '—'}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {b.flightNumber || '—'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {b.airline || '—'}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div
                        style={{
                          fontWeight: 500,
                          color: '#334155',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.fromCity || '—'}{' '}
                        <span style={{ color: '#0284c7' }}>→</span>{' '}
                        {b.toCity || '—'}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {b.departureTime || '—'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {b.departureDate
                          ? String(b.departureDate).slice(0, 10)
                          : '—'}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {b.passengerName || '—'}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px', whiteSpace: 'nowrap' }}>
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
                          marginRight: '6px',
                        }}
                      >
                        {b.seatNumber || '—'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {b.class || '—'}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: '16px 18px',
                        fontWeight: 700,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatINR(b.finalAmount ?? b.ticketPrice)}

                      {Number(b.discountAmount) > 0 && (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: '#059669',
                            fontWeight: 600,
                          }}
                        >
                          Saved {formatINR(b.discountAmount)}
                        </div>
                      )}
                    </td>

                    {/* All four statuses in one horizontal row */}
                    <td style={{ padding: '16px 18px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          flexWrap: 'nowrap',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          minWidth: '400px',
                        }}
                      >
                        {STATUS_OPTIONS.map((option) => {
                          const active =
                            normalizedStatus === normalizeStatus(option);

                          return (
                            <button
                              key={option}
                              type="button"
                              title={`Filter by ${option}`}
                              aria-pressed={active}
                              onClick={() => onStatusFilter?.(option)}
                              className={`badge ${STATUS_BADGES[option]}`}
                              style={{
                                padding: '5px 8px',
                                border: active
                                  ? '2px solid #0284c7'
                                  : '1px solid transparent',
                                borderRadius: '6px',
                                whiteSpace: 'nowrap',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td style={{ padding: '16px 18px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          flexWrap: 'nowrap',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onView?.(b)}
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
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>

                        {normalizedStatus !== 'failed' && (
                          <button
                            type="button"
                            onClick={() => onDownload?.(b)}
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
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Download size={14} />
                            <span>Ticket</span>
                          </button>
                        )}

                        {isActiveBooking(b) && onReschedule && (
                          <button
                            type="button"
                            onClick={() => onReschedule(b)}
                            title="Reschedule Booking"
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
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <CalendarClock size={14} />
                            <span>Reschedule</span>
                          </button>
                        )}

                        {isActiveBooking(b) && (
                          <button
                            type="button"
                            onClick={() => onCancel?.(b.bookingId)}
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
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <XCircle size={14} />
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
