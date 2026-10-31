import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Armchair,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  Plane,
  PlaneTakeoff,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { calculateEconomyFare, calculateClassFare, formatINR } from '../utils/flightPricing';
import {
  formatDistanceKm,
  formatStops,
  getAirportCode,
  getFlightDetails,
  normalizeDurationDisplay,
} from '../utils/flightRoute';
import './FlightCard.css';

const AIRLINE_THEMES = {
  indigo: { bg: '#001b94', color: '#fff', code: '6E', name: 'IndiGo' },
  spicejet: { bg: '#e81e25', color: '#fff', code: 'SG', name: 'SpiceJet' },
  'air india': { bg: '#ed1b24', color: '#fef08a', code: 'AI', name: 'Air India' },
  vistara: { bg: '#501538', color: '#fcd34d', code: 'UK', name: 'Vistara' },
  'akasa air': { bg: '#ff6600', color: '#fff', code: 'QP', name: 'Akasa Air' },
  akasa: { bg: '#ff6600', color: '#fff', code: 'QP', name: 'Akasa Air' },
};

function getAirlineTheme(airlineName) {
  const norm = String(airlineName || '').trim().toLowerCase();
  for (const [key, theme] of Object.entries(AIRLINE_THEMES)) {
    if (norm.includes(key)) return theme;
  }
  const code = (airlineName ? airlineName.slice(0, 2) : 'FL').toUpperCase();
  return { bg: '#0284c7', color: '#fff', code, name: airlineName || 'Airline' };
}

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
  const duration = normalizeDurationDisplay(durationText) || durationText || 'Duration unavailable';
  const calendarDayOffset = departureDate && arrivalDate
    ? Math.round((arrivalDate.getTime() - departureDate.getTime()) / 86400000)
    : 0;

  return {
    duration,
    dayOffset: Math.max(0, calendarDayOffset),
  };
}

export default function FlightCard({ flight, couponCode, selectedCabin = 'All', passengerCount = 1 }) {
  const navigate = useNavigate();
  const [openPanel, setOpenPanel] = useState(null);

  const rawPrice = Number(flight.price);
  const baseFare = rawPrice > 0
    ? rawPrice
    : calculateEconomyFare(flight.distanceKm, flight.departureTime, flight.flightNumber, flight.airline);
  const bookingClass = selectedCabin === 'All' ? 'Economy' : selectedCabin;
  const fare = calculateClassFare(baseFare, bookingClass);
  const totalFare = fare === null ? null : fare * Math.max(1, Number(passengerCount) || 1);
  const fareAvailable = Number.isFinite(fare) && fare > 0;
  const canBook = Number(flight.availableSeats) >= Math.max(1, Number(passengerCount) || 1) && fareAvailable;
  const schedule = getSchedule(flight);
  const flightDetails = getFlightDetails(flight);
  const logoUrl = flight.airlineLogoUrl || flight.logoUrl || '';
  const airlineTheme = getAirlineTheme(flight.airline);
  const departureAirport = getAirportCode(flight.fromCity, flight.fromAirportCode);
  const arrivalAirport = getAirportCode(flight.toCity, flight.toAirportCode);
  const dateDifference = schedule.dayOffset > 0 ? `+${schedule.dayOffset} day${schedule.dayOffset === 1 ? '' : 's'}` : '';
  const stopsText = formatStops(flight.stopCount);
  const distanceKm = flight.distanceKm || flightDetails.distanceKm;
  const distanceText = formatDistanceKm(distanceKm);

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
          <div
            className="flight-ticket-airline-badge"
            style={{ backgroundColor: airlineTheme.bg, color: airlineTheme.color }}
            aria-label={flight.airline}
            title={flight.airline}
          >
            <span>{airlineTheme.code}</span>
          </div>
        )}
        <div className="flight-ticket-airline-copy">
          <strong>{flight.airline || 'Airline unavailable'}</strong>
          <span>{flight.flightNumber || 'Flight number unavailable'}</span>
        </div>
      </section>

      <section className="flight-ticket-point flight-ticket-departure" aria-label="Departure">
        <strong className="flight-ticket-time">{formatTime(flight.departureTime)}</strong>
        <strong className="flight-ticket-airport">{departureAirport}</strong>
        <span className="flight-ticket-city">{flight.fromCity}</span>
        <span className="flight-ticket-date">
          <CalendarDays size={13} />
          {formatDay(flight.departureDate)}, {formatDate(flight.departureDate)}
        </span>
      </section>

      <section className="flight-ticket-route" aria-label="Flight duration, distance, and stops">
        <span className="flight-ticket-duration">
          <Clock3 size={13} />
          {flightDetails.duration}
        </span>
        <div className="flight-ticket-route-line">
          <span />
          <Plane size={15} />
          <span />
        </div>
        <span className={`flight-ticket-stops ${flight.stopCount > 0 ? 'flight-ticket-stops-connecting' : 'flight-ticket-stops-direct'}`}>
          {stopsText}
        </span>
        {distanceText && (
          <span className="flight-ticket-distance" title="Route distance in kilometers">
            <MapPin size={11} />
            {distanceText}
          </span>
        )}
      </section>

      <section className="flight-ticket-point flight-ticket-arrival" aria-label="Arrival">
        <strong className="flight-ticket-time">{formatTime(flight.arrivalTime)}</strong>
        <strong className="flight-ticket-airport">
          {arrivalAirport}
          {dateDifference && <sup className="flight-ticket-day-offset">{dateDifference}</sup>}
        </strong>
        <span className="flight-ticket-city">{flight.toCity}</span>
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
          <div><span>From City</span><strong>{flightDetails.fromCity}</strong></div>
          <div><span>To City</span><strong>{flightDetails.toCity}</strong></div>
          <div><span>Distance</span><strong>{flightDetails.distanceDisplay}</strong></div>
          <div><span>Stop Count</span><strong>{flightDetails.stopCount}</strong></div>
          <div><span>Flight Type</span><strong>{flightDetails.flightType}</strong></div>
          <div><span>Duration</span><strong>{flightDetails.duration}</strong></div>
          <div><span>Airline</span><strong>{flight.airline}</strong></div>
          <div><span>Flight number</span><strong>{flight.flightNumber}</strong></div>
          {flight.bookingDate && (
            <div><span>Booking Date</span><strong>{formatDate(flight.bookingDate)}</strong></div>
          )}
          <div><span>Departure</span><strong>{departureLocation} · {formatTime(flight.departureTime)}</strong></div>
          <div><span>Arrival</span><strong>{arrivalLocation} · {formatTime(flight.arrivalTime)}</strong></div>
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
