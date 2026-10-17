import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Armchair,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Plane,
  PlaneTakeoff,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { calculateClassFare, formatINR, getClassMultiplier } from '../utils/flightPricing';
import './FlightCard.css';

function getFlightDate(dateValue) {
  if (!dateValue) return null;
  const [year, month, day] = String(dateValue).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(dateValue) {
  const date = getFlightDate(dateValue);
  if (!date) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDay(dateValue) {
  const date = getFlightDate(dateValue);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(date);
}

function formatTime(timeValue) {
  const match = String(timeValue || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 'Time unavailable';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)));
}

function getSchedule(flight) {
  const departureDate = getFlightDate(flight.departureDate);
  const arrivalDate = getFlightDate(flight.arrivalDate);
  const durationText = String(flight.duration || '').trim();
  const durationMatch = durationText.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i);
  const duration = durationMatch && (durationMatch[1] || durationMatch[2])
    ? [durationMatch[1] ? `${durationMatch[1]}h` : '', durationMatch[2] ? `${durationMatch[2]}m` : '']
      .filter(Boolean)
      .join(' ')
    : durationText || 'Duration unavailable';
  const calendarDayOffset = departureDate && arrivalDate
    ? Math.round((arrivalDate.getTime() - departureDate.getTime()) / 86400000)
    : 0;

  return {
    duration,
    dayOffset: Math.max(0, calendarDayOffset),
  };
}

function formatAirport(code, city) {
  const airportCode = String(code || '').trim().toUpperCase();
  return airportCode || city || 'Airport unavailable';
}

export default function FlightCard({ flight, couponCode, selectedCabin = 'All', passengerCount = 1 }) {
  const navigate = useNavigate();
  const [openPanel, setOpenPanel] = useState(null);

  const baseFare = Number(flight.price);
  const bookingClass = selectedCabin === 'All' ? 'Economy' : selectedCabin;
  const fare = calculateClassFare(baseFare, bookingClass);
  const totalFare = fare === null ? null : fare * Math.max(1, Number(passengerCount) || 1);
  const fareAvailable = Number.isFinite(fare) && fare > 0;
  const canBook = Number(flight.availableSeats) >= Math.max(1, Number(passengerCount) || 1) && fareAvailable;
  const schedule = getSchedule(flight);
  const logoUrl = flight.airlineLogoUrl || flight.logoUrl || '';
  const departureLocation = formatAirport(flight.fromAirportCode, flight.fromCity);
  const arrivalLocation = formatAirport(flight.toAirportCode, flight.toCity);
  const dateDifference = schedule.dayOffset > 0 ? `+${schedule.dayOffset} day${schedule.dayOffset === 1 ? '' : 's'}` : '';
  const stopsLabel = Number.isInteger(flight.stopCount)
    ? flight.stopCount === 0 ? 'Non-stop' : `${flight.stopCount} stop${flight.stopCount === 1 ? '' : 's'}`
    : 'Stops not provided';

  const handleSelect = () => {
    if (!canBook) return;
    navigate('/ticket-booking', {
      state: {
        flight,
        fare,
        baseFare,
        selectedClass: bookingClass,
        passengerCount: Math.max(1, Number(passengerCount) || 1),
        couponCode,
      },
    });
  };

  const togglePanel = (panel) => setOpenPanel((current) => current === panel ? null : panel);

  return (
    <article className="flight-ticket-card">
      <section className="flight-ticket-airline" aria-label="Airline">
        {logoUrl ? (
          <img className="flight-ticket-logo" src={logoUrl} alt={`${flight.airline} logo`} />
        ) : (
          <div className="flight-ticket-logo-fallback" aria-hidden="true">
            <Plane size={20} />
          </div>
        )}
        <div className="flight-ticket-airline-copy">
          <strong>{flight.airline || 'Airline unavailable'}</strong>
          <span>{flight.flightNumber || 'Flight number unavailable'}</span>
        </div>
      </section>

      <section className="flight-ticket-point flight-ticket-departure" aria-label="Departure">
        <strong className="flight-ticket-time">{formatTime(flight.departureTime)}</strong>
        <strong className="flight-ticket-airport">{departureLocation}</strong>
        {flight.fromAirportCode && <span className="flight-ticket-city">{flight.fromCity}</span>}
        <span className="flight-ticket-date">
          <CalendarDays size={13} />
          {formatDay(flight.departureDate)}, {formatDate(flight.departureDate)}
        </span>
      </section>

      <section className="flight-ticket-route" aria-label="Flight duration and stops">
        <span className="flight-ticket-duration">
          <Clock3 size={13} />
          {schedule.duration}
        </span>
        <div className="flight-ticket-route-line">
          <span />
          <Plane size={15} />
          <span />
        </div>
        <span className={`flight-ticket-stops${Number.isInteger(flight.stopCount) ? '' : ' flight-ticket-stops-unavailable'}`}>
          {stopsLabel}
        </span>
      </section>

      <section className="flight-ticket-point flight-ticket-arrival" aria-label="Arrival">
        <strong className="flight-ticket-time">{formatTime(flight.arrivalTime)}</strong>
        <strong className="flight-ticket-airport">
          {arrivalLocation}
          {dateDifference && <sup className="flight-ticket-day-offset">{dateDifference}</sup>}
        </strong>
        {flight.toAirportCode && <span className="flight-ticket-city">{flight.toCity}</span>}
        <span className="flight-ticket-date">
          <CalendarDays size={13} />
          {formatDay(flight.arrivalDate)}, {formatDate(flight.arrivalDate)}
        </span>
      </section>

      <section className="flight-ticket-fare" aria-label="Fare">
        <span className="flight-ticket-fare-label">{bookingClass} fare{passengerCount > 1 ? ` · ${passengerCount} travellers` : ' · per traveller'}</span>
        <strong className="flight-ticket-price">{fareAvailable ? formatINR(totalFare) : 'Fare unavailable'}</strong>
        
        <button
          className="flight-ticket-select"
          type="button"
          disabled={!canBook}
          onClick={handleSelect}
        >
          {Number(flight.availableSeats) < Math.max(1, Number(passengerCount) || 1) ? 'Not enough seats' : 'Select'}
        </button>
      </section>

      <footer className="flight-ticket-footer">
        <span className="flight-ticket-seats">
          <Users size={14} />
          {flight.availableSeats} seats available
        </span>
        {flight.baggageAllowance && (
          <span className="flight-ticket-meta">
            <BriefcaseBusiness size={14} />
            {flight.baggageAllowance}
          </span>
        )}
        <span className="flight-ticket-fare-type">
          <ShieldCheck size={14} />
          Regular Fare
        </span>
        {flight.bookingDate && (
          <span className="flight-ticket-meta" title="Booking Date">
            <CalendarDays size={14} />
            Booking: {formatDate(flight.bookingDate)}
          </span>
        )}
        <button
          type="button"
          className="flight-ticket-link"
          aria-expanded={openPanel === 'details'}
          onClick={() => togglePanel('details')}
        >
          <PlaneTakeoff size={14} />
          Flight Details
          {openPanel === 'details' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          type="button"
          className="flight-ticket-link"
          aria-expanded={openPanel === 'rules'}
          onClick={() => togglePanel('rules')}
        >
          <Armchair size={14} />
          Fare Rule
          {openPanel === 'rules' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </footer>

      {openPanel === 'details' && (
        <div className="flight-ticket-expanded">
          <div><span>Airline</span><strong>{flight.airline}</strong></div>
          <div><span>Flight number</span><strong>{flight.flightNumber}</strong></div>
          {flight.bookingDate && (
            <div><span>Booking Date</span><strong>{formatDate(flight.bookingDate)}</strong></div>
          )}
          <div><span>Departure</span><strong>{departureLocation} · {formatTime(flight.departureTime)}</strong></div>
          <div><span>Arrival</span><strong>{arrivalLocation} · {formatTime(flight.arrivalTime)}</strong></div>
          <div><span>Duration</span><strong>{schedule.duration}</strong></div>
          <div><span>Stops</span><strong>{stopsLabel}</strong></div>
          {flight.baggageAllowance && (
            <div><span>Baggage allowance</span><strong>{flight.baggageAllowance}</strong></div>
          )}
        </div>
      )}

      {openPanel === 'rules' && (
        <div className="flight-ticket-expanded flight-ticket-fare-rules">
          <strong>Regular Fare</strong>
          <span>The displayed amount is the flight&apos;s current base fare. Your final payable amount, applicable charges, and coupon discount are confirmed on the booking page.</span>
        </div>
      )}
    </article>
  );
}
