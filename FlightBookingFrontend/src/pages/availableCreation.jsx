import React, { useEffect, useRef, useState } from 'react';
import {
  PlaneTakeoff,
  PlaneLanding,
  Calendar,
  Clock,
  Users,
  Hash,
  Timer,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Plane,
  Plus,
  Ruler,
  Trash2,
  Pencil,
} from 'lucide-react';

import { flightApi } from '../services/api';
import {
  calculateEconomyFare,
  calculateItineraryFare,
  formatINR,
} from '../utils/flightPricing';

import {
  SUPPORTED_CITY_NAMES,
  calculateRouteDistance,
  isSameCity,
  recalculateSegment,
  toTimestamp,
} from '../utils/flightRoute';

import { authUtil } from '../utils/auth';
import './availableCreation.css';

/* -------------------- Constants -------------------- */

const TRIP_TYPES = [
  { id: 'OneWay', label: 'One Way' },
  { id: 'RoundTrip', label: 'Round Trip' },
  { id: 'MultiCity', label: 'Multi-City' },
];

const TRIP_LABELS = {
  OneWay: 'One Way',
  RoundTrip: 'Round Trip',
  MultiCity: 'Multi-City',
};

const MIN_MULTI_CITY_SEGMENTS = 2;
const MAX_MULTI_CITY_SEGMENTS = 6;
const SUCCESS_MESSAGE = 'Your flight creation was successful !';

const pad = (value) => String(value).padStart(2, '0');

const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
};

let segmentKeyCounter = 0;

const emptySegment = (overrides = {}) => ({
  key: `segment-${++segmentKeyCounter}`,
  flightNumber: '',
  airline: '',
  fromCity: '',
  toCity: '',
  distanceKm: '',  
  departureDate: '',
  departureTime: '',
  arrivalDate: '',
  arrivalTime: '',
  duration: '',
  totalSeats: '',
  availableSeats: '',
  status: 'Scheduled',
  ...overrides,
});

const freshSegments = (tripType) =>
  tripType === 'OneWay'
    ? [emptySegment()]
    : [emptySegment(), emptySegment()];

const initialSegmentsByType = () => ({
  OneWay: freshSegments('OneWay'),
  RoundTrip: freshSegments('RoundTrip'),
  MultiCity: freshSegments('MultiCity'),
});

const errorKey = (segment, field) => `${segment.key}.${field}`;

const segmentFare = (segment) =>
  calculateEconomyFare(segment.distanceKm);

function segmentLabel(tripType, index) {
  if (tripType === 'RoundTrip') {
    return index === 0 ? 'Outbound Flight' : 'Return Flight';
  }

  if (tripType === 'MultiCity') {
    return `Flight ${index + 1}`;
  }

  return 'Flight Details';
}

function toPayload(segment) {
  return {
    flightNumber: segment.flightNumber.trim(),
    airline: segment.airline.trim(),
    fromCity: segment.fromCity.trim(),
    toCity: segment.toCity.trim(),
    distanceKm: parseFloat(segment.distanceKm),
    departureDate: segment.departureDate,
    departureTime: segment.departureTime,
    arrivalDate: segment.arrivalDate,
    arrivalTime: segment.arrivalTime,
    duration: segment.duration.trim(),
    totalSeats: parseInt(segment.totalSeats, 10),
    availableSeats: parseInt(segment.availableSeats, 10),
    status: segment.status,
  };
}

function segmentFromFlight(flight) {
  return emptySegment({
    flightNumber: flight.flightNumber ?? '',
    airline: flight.airline ?? '',
    fromCity: flight.fromCity ?? '',
    toCity: flight.toCity ?? '',
    distanceKm: String(flight.distanceKm ?? ''),
    
    departureDate: flight.departureDate ?? '',
    departureTime: flight.departureTime ?? '',
    arrivalDate: flight.arrivalDate ?? '',
    arrivalTime: flight.arrivalTime ?? '',
    duration: flight.duration ?? '',
    totalSeats: String(flight.totalSeats ?? ''),
    availableSeats: String(flight.availableSeats ?? ''),
    status: flight.status || 'Scheduled',
  });
}

/* -------------------- Validation -------------------- */

function validateSegment(segment, today) {
  const errs = {};

  const required = (field, label) => {
    if (!String(segment[field] ?? '').trim()) {
      errs[field] = `${label} is required.`;
    }
  };

  required('flightNumber', 'Flight Number');
  required('airline', 'Airline');
  required('fromCity', 'Flying From');
  required('toCity', 'Flying To');
  required('departureDate', 'Departure Date');
  required('departureTime', 'Departure Time');

  if (segment.fromCity.trim() && segment.toCity.trim()) {
    if (isSameCity(segment.fromCity, segment.toCity)) {
      errs.toCity = 'Flying To must be different from Flying From.';
    } else if (!calculateRouteDistance(segment.fromCity, segment.toCity)) {
      errs.toCity =
        'Route distance is unavailable. Choose cities from the supported list.';
    }
  }

  if (
    !errs.toCity &&
    !errs.fromCity &&
    !segment.distanceKm &&
    segment.fromCity.trim() &&
    segment.toCity.trim()
  ) {
    errs.distanceKm = 'Route distance is required.';
  }


  if (segment.departureDate && segment.departureDate < today) {
    errs.departureDate = 'Departure date must be today or later.';
  }

  if (
    segment.departureDate &&
    segment.arrivalDate &&
    toTimestamp(segment.arrivalDate, segment.arrivalTime) <=
      toTimestamp(segment.departureDate, segment.departureTime)
  ) {
    errs.arrivalDate = 'Arrival must be after departure.';
  }

  const total = parseInt(segment.totalSeats, 10);
  const available = parseInt(segment.availableSeats, 10);

  if (segment.totalSeats === '') {
    errs.totalSeats = 'Total Seats is required.';
  } else if (Number.isNaN(total) || total <= 0) {
    errs.totalSeats = 'Total Seats must be a positive number.';
  }

  if (segment.availableSeats === '') {
    errs.availableSeats = 'Available Seats is required.';
  } else if (Number.isNaN(available) || available < 0) {
    errs.availableSeats = 'Available Seats cannot be negative.';
  } else if (!Number.isNaN(total) && available > total) {
    errs.availableSeats = 'Available Seats cannot exceed Total Seats.';
  }

  return errs;
}

function validateItinerary(tripType, segments, today) {
  const errors = {};
  let formError = '';

  const put = (segment, field, message) => {
    const key = errorKey(segment, field);

    if (!errors[key]) {
      errors[key] = message;
    }
  };

  segments.forEach((segment) => {
    Object.entries(validateSegment(segment, today)).forEach(
      ([field, message]) => put(segment, field, message)
    );
  });

  if (tripType === 'RoundTrip') {
    const [outbound, inbound] = segments;

    if (inbound.departureDate && outbound.departureDate) {
      if (inbound.departureDate < outbound.departureDate) {
        put(
          inbound,
          'departureDate',
          'Return date must be after the outbound departure date.'
        );
      } else if (
        toTimestamp(inbound.departureDate, inbound.departureTime) <
        toTimestamp(outbound.arrivalDate, outbound.arrivalTime)
      ) {
        put(
          inbound,
          'departureDate',
          'Return flight must depart after the outbound flight arrives.'
        );
      }
    }
  }

  if (tripType === 'MultiCity') {
    if (segments.length < MIN_MULTI_CITY_SEGMENTS) {
      formError = `Multi-City needs at least ${MIN_MULTI_CITY_SEGMENTS} flights.`;
    }

    for (let i = 1; i < segments.length; i += 1) {
      const previous = segments[i - 1];
      const current = segments[i];

      if (
        current.departureDate &&
        previous.arrivalDate &&
        toTimestamp(current.departureDate, current.departureTime) <
          toTimestamp(previous.arrivalDate, previous.arrivalTime)
      ) {
        put(
          current,
          'departureDate',
          `Flight ${i + 1} must depart after flight ${i} arrives.`
        );
      }
    }
  }

  const seen = new Map();

  segments.forEach((segment) => {
    if (
      !segment.flightNumber.trim() ||
      !segment.departureDate ||
      !segment.departureTime
    ) {
      return;
    }

    const id = `${segment.flightNumber.trim().toUpperCase()}|${segment.departureDate}|${segment.departureTime}`;

    if (seen.has(id)) {
      put(
        segment,
        'flightNumber',
        'This flight number is already used with the same departure date and time.'
      );
    }

    seen.set(id, true);
  });

  return { errors, formError };
}

/* -------------------- Field Component -------------------- */

function Field({ id, label, icon: Icon, error, hint, children }) {
  return (
    <div className="ac-field">
      <label className="ac-label" htmlFor={id}>
        {Icon && <Icon size={14} />}
        {label}
      </label>

      {children}

      {error && (
        <span className="ac-error" role="alert">
          {error}
        </span>
      )}

      {!error && hint && <span className="ac-hint">{hint}</span>}
    </div>
  );
}

/* -------------------- Flight Segment Form -------------------- */

function SegmentForm({
  segment,
  index,
  tripType,
  errors,
  today,
  minDepartureDate,
  readOnlyRoute,
  canRemove,
  disabled,
  onChange,
  onRemove,
}) {
  const fare = segmentFare(segment);

  const fieldId = (name) => `${segment.key}-${name}`;
  const err = (name) => errors[errorKey(segment, name)];

  const input = (name, extra = {}) => ({
    id: fieldId(name),
    name,
    className: `ac-input${err(name) ? ' has-error' : ''}`,
    value: segment[name],
    onChange: (event) => onChange(index, name, event.target.value),
    disabled,
    'aria-invalid': err(name) ? 'true' : undefined,
    ...extra,
  });

  const routeSummary =
    segment.fromCity && segment.toCity
      ? `${segment.fromCity} → ${segment.toCity}`
      : '';

  return (
    <section
      className="ac-segment"
      aria-label={segmentLabel(tripType, index)}
    >
      <div className="ac-segment-head">
        {tripType !== 'OneWay' && (
          <span className="ac-segment-badge">{index + 1}</span>
        )}

        <span className="ac-segment-title">
          {segmentLabel(tripType, index)}
        </span>

        {routeSummary && (
          <span className="ac-segment-route">{routeSummary}</span>
        )}

        {canRemove && (
          <button
            type="button"
            className="ac-remove"
            onClick={() => onRemove(index)}
            disabled={disabled}
          >
            <Trash2 size={14} /> Remove Flight
          </button>
        )}
      </div>

      <div className="ac-grid">
        <Field
          id={fieldId('fromCity')}
          label="Flying From"
          icon={PlaneTakeoff}
          error={err('fromCity')}
          hint={
            readOnlyRoute
              ? 'Set automatically from the outbound destination.'
              : undefined
          }
        >
          <input
            {...input('fromCity', {
              placeholder: 'e.g. Chennai',
              autoComplete: 'off',
              list: 'supported-flight-cities',
              readOnly: readOnlyRoute,
            })}
          />
        </Field>

        <Field
          id={fieldId('toCity')}
          label="Flying To"
          icon={PlaneLanding}
          error={err('toCity')}
          hint={
            readOnlyRoute
              ? 'Set automatically from the outbound origin.'
              : undefined
          }
        >
          <input
            {...input('toCity', {
              placeholder: 'e.g. Delhi',
              autoComplete: 'off',
              list: 'supported-flight-cities',
              readOnly: readOnlyRoute,
            })}
          />
        </Field>


        <Field
          id={fieldId('departureDate')}
          label="Departure Date"
          icon={Calendar}
          error={err('departureDate')}
        >
          <input
            {...input('departureDate', {
              type: 'date',
              min: minDepartureDate || today,
            })}
          />
        </Field>

        <Field
          id={fieldId('departureTime')}
          label="Departure Time"
          icon={Clock}
          error={err('departureTime')}
        >
          <input {...input('departureTime', { type: 'time' })} />
        </Field>

        <Field
          id={fieldId('arrivalDate')}
          label="Arrival Date"
          icon={Calendar}
          error={err('arrivalDate')}
        >
          <input
            {...input('arrivalDate', {
              type: 'date',
              readOnly: true,
              tabIndex: -1,
            })}
          />
        </Field>

        <Field
          id={fieldId('arrivalTime')}
          label="Arrival Time"
          icon={Clock}
          error={err('arrivalTime')}
        >
          <input
            {...input('arrivalTime', {
              type: 'time',
              readOnly: true,
              tabIndex: -1,
            })}
          />
        </Field>

        <Field
          id={fieldId('duration')}
          label="Duration"
          icon={Timer}
          error={err('duration')}
        >
          <input
            {...input('duration', {
              placeholder: 'Calculated from the route',
              readOnly: true,
              tabIndex: -1,
            })}
          />
        </Field>

        <Field
          id={fieldId('distanceKm')}
          label="Route Distance (km)"
          icon={Ruler}
          error={err('distanceKm')}
        >
          <input
            {...input('distanceKm', {
              type: 'number',
              placeholder: 'Select both cities',
              readOnly: true,
              tabIndex: -1,
            })}
          />
        </Field>

        <Field
          id={fieldId('airline')}
          label="Airline"
          icon={Plane}
          error={err('airline')}
        >
          <input
            {...input('airline', {
              placeholder: 'e.g. Air India',
              autoComplete: 'off',
            })}
          />
        </Field>

        <Field
          id={fieldId('flightNumber')}
          label="Flight Number"
          icon={Hash}
          error={err('flightNumber')}
        >
          <input
            {...input('flightNumber', {
              placeholder: 'e.g. AI-202',
              autoComplete: 'off',
            })}
          />
        </Field>


      </div>
    </section>
  );
}

/* -------------------- Main Component -------------------- */

export default function AvailableCreation() {
  const isAdmin = authUtil.isAdmin();
  const today = getToday();

  const [tripType, setTripType] = useState('OneWay');
  const [segmentsByType, setSegmentsByType] = useState(
    initialSegmentsByType
  );

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [createdSummary, setCreatedSummary] = useState(null);
  const [editingFlightId, setEditingFlightId] = useState(null);

  const [flights, setFlights] = useState([]);
  const [flightListLoading, setFlightListLoading] = useState(true);
  const [flightListError, setFlightListError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingFlightId, setDeletingFlightId] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const segments = segmentsByType[tripType];
  const editing = editingFlightId !== null;

  /* -------------------- Load Flights -------------------- */

  const refreshFlights = async () => {
    try {
      const response = await flightApi.getAll();
      const data = response.data;

      setFlights(Array.isArray(data) ? data : []);
      setFlightListError('');
    } catch (err) {
      setFlightListError(
        err.response?.data?.message ||
          'Flights could not be loaded. Please try again.'
      );
    } finally {
      setFlightListLoading(false);
    }
  };

  useEffect(() => {
    refreshFlights();
  }, []);

  /* -------------------- Clear Messages -------------------- */

  const clearMessages = () => {
    setSuccessMsg('');
    setErrorMsg('');
    setCreatedSummary(null);
    setFormError('');
  };

  const clearErrorsFor = (segment, fields) => {
    setErrors((prev) => {
      const next = { ...prev };

      fields.forEach((field) => {
        delete next[errorKey(segment, field)];
      });

      return next;
    });
  };

  const switchTripType = (nextType) => {
    if (nextType === tripType || submitting || editing) return;

    setTripType(nextType);
    setErrors({});
    clearMessages();
  };

  /* -------------------- Handle Field Changes -------------------- */

  const handleSegmentChange = (index, name, rawValue) => {
    const value = rawValue;

    const list = segmentsByType[tripType].map((segment) => ({
      ...segment,
    }));

    const previousToCity = list[index].toCity;
    const routeFields = ['fromCity', 'toCity'];
    const timingFields = ['departureDate', 'departureTime'];

    list[index][name] = value;

    if (
      routeFields.includes(name) ||
      timingFields.includes(name)
    ) {
      list[index] = recalculateSegment(list[index]);
    }

    clearErrorsFor(list[index], [
      name,
      'distanceKm',
      'arrivalDate',
      ...(routeFields.includes(name) ? routeFields : []),
    ]);

    // Round trip: return route is the reverse of outbound route.
    if (
      tripType === 'RoundTrip' &&
      index === 0 &&
      routeFields.includes(name)
    ) {
      list[1] = recalculateSegment({
        ...list[1],
        fromCity: list[0].toCity,
        toCity: list[0].fromCity,
      });

      clearErrorsFor(list[1], [
        'fromCity',
        'toCity',
        'distanceKm',
        'arrivalDate',
      ]);
    }

    // Multi-city: keep the next flight's origin in sync.
    if (
      tripType === 'MultiCity' &&
      name === 'toCity' &&
      index < list.length - 1
    ) {
      const next = list[index + 1];

      if (
        !next.fromCity.trim() ||
        isSameCity(next.fromCity, previousToCity)
      ) {
        list[index + 1] = recalculateSegment({
          ...next,
          fromCity: value,
        });

        clearErrorsFor(list[index + 1], [
          'fromCity',
          'toCity',
          'distanceKm',
          'arrivalDate',
        ]);
      }
    }

    setSegmentsByType((prev) => ({
      ...prev,
      [tripType]: list,
    }));

    clearMessages();
  };

  /* -------------------- Multi-City Controls -------------------- */

  const addSegment = () => {
    if (
      tripType !== 'MultiCity' ||
      segments.length >= MAX_MULTI_CITY_SEGMENTS ||
      submitting
    ) {
      return;
    }

    const last = segments[segments.length - 1];

    const added = recalculateSegment(
      emptySegment({
        fromCity: last.toCity,
        departureDate: last.arrivalDate || last.departureDate,
      })
    );

    setSegmentsByType((prev) => ({
      ...prev,
      MultiCity: [...prev.MultiCity, added],
    }));

    clearMessages();
  };

  const removeSegment = (index) => {
    if (
      tripType !== 'MultiCity' ||
      index < MIN_MULTI_CITY_SEGMENTS ||
      submitting
    ) {
      return;
    }

    const removed = segments[index];

    setSegmentsByType((prev) => ({
      ...prev,
      MultiCity: prev.MultiCity.filter((_, i) => i !== index),
    }));

    setErrors((prev) => {
      const next = { ...prev };

      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${removed.key}.`)) {
          delete next[key];
        }
      });

      return next;
    });

    clearMessages();
  };

  /* -------------------- Submit Flight -------------------- */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submittingRef.current) return;

    clearMessages();

    const result = validateItinerary(tripType, segments, today);

    if (
      Object.keys(result.errors).length > 0 ||
      result.formError
    ) {
      setErrors(result.errors);
      setFormError(
        result.formError ||
          'Please correct the highlighted fields.'
      );
      return;
    }

    setErrors({});
    submittingRef.current = true;
    setSubmitting(true);

    try {
      if (editing) {
        await flightApi.update(
          editingFlightId,
          toPayload(segments[0])
        );

        setSuccessMsg('Flight updated successfully!');
        window.alert('Flight updated successfully!');

        setEditingFlightId(null);
      } else {
        const response = await flightApi.createItinerary({
          tripType,
          segments: segments.map(toPayload),
        });

        setCreatedSummary(response.data);
        setSuccessMsg(SUCCESS_MESSAGE);
        window.alert(SUCCESS_MESSAGE);
      }

      setSegmentsByType((prev) => ({
        ...prev,
        [tripType]: freshSegments(tripType),
      }));

      await refreshFlights();
    } catch (err) {
      const data = err?.response?.data;

      setErrorMsg(
        data?.message ||
          (typeof data === 'string' ? data : null) ||
          `Failed to ${
            editing ? 'update' : 'create'
          } flight. Please check your input and try again.`
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  /* -------------------- Reset Form -------------------- */

  const handleReset = () => {
    setSegmentsByType((prev) => ({
      ...prev,
      [tripType]: freshSegments(tripType),
    }));

    setEditingFlightId(null);
    setErrors({});
    clearMessages();
  };

  /* -------------------- Edit Flight -------------------- */

  const handleEditFlight = (flight) => {
    setTripType('OneWay');

    setSegmentsByType((prev) => ({
      ...prev,
      OneWay: [segmentFromFlight(flight)],
    }));

    setEditingFlightId(flight.flightId);
    setErrors({});
    clearMessages();

    document
      .getElementById('flightManagementForm')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  /* -------------------- Delete Flight -------------------- */

  const handleDeleteFlight = async () => {
    if (!deleteTarget || deletingFlightId !== null) return;

    const flightId = deleteTarget.flightId;

    setDeletingFlightId(flightId);
    setDeleteError('');

    try {
      await flightApi.delete(flightId);

      setFlights((current) =>
        current.filter(
          (flight) => flight.flightId !== flightId
        )
      );

      setDeleteTarget(null);
      window.alert('Flight deleted successfully!');
    } catch (err) {
      setDeleteError(
        err.response?.data?.message ||
          'Failed to delete flight. Please try again.'
      );
    } finally {
      setDeletingFlightId(null);
    }
  };

  /* -------------------- Derived Values -------------------- */

  const totalFare =
    tripType === 'OneWay'
      ? null
      : calculateItineraryFare(
          segments.map((segment) => segment.distanceKm)
        );

  const errorList = Object.values(errors);

  const submitLabel = editing
    ? 'Save Changes'
    : tripType === 'OneWay'
      ? 'Create Flight'
      : tripType === 'RoundTrip'
        ? 'Create Round Trip'
        : 'Create Itinerary';

  const minDepartureFor = (index) => {
    if (tripType === 'RoundTrip' && index === 1) {
      return segments[0].departureDate || today;
    }

    if (tripType === 'MultiCity' && index > 0) {
      return (
        segments[index - 1].arrivalDate ||
        segments[index - 1].departureDate ||
        today
      );
    }

    return today;
  };

  const describeFlight = (flight) => {
    const type = TRIP_LABELS[flight.tripType] || 'One Way';

    if (flight.tripType === 'RoundTrip') {
      return `${type} · ${
        flight.segmentOrder === 2 ? 'Return' : 'Outbound'
      }`;
    }

    if (flight.tripType === 'MultiCity') {
      return `${type} · Flight ${flight.segmentOrder ?? ''}`.trim();
    }

    return type;
  };

  // Show the newest flights first, limited to 10.
  const sortedFlights = [...flights]
    .sort(
      (a, b) =>
        Number(b.flightId || 0) - Number(a.flightId || 0)
    )
    .slice(0, 10);

  /* -------------------- Render -------------------- */

  return (
    <div className="ac-page">
      <header className="ac-hero">
        <div className="ac-hero-icon">
          <Plane
            size={24}
            color="#fff"
            style={{ transform: 'rotate(-45deg)' }}
          />
        </div>

        <div>
          <h1>
            {editing
              ? `Edit Flight ${segments[0].flightNumber}`
              : 'Create New Flight'}
          </h1>

          <p>
            Add a one-way flight, a round trip, or a multi-city
            itinerary to the reservation system.
          </p>
        </div>
      </header>

      {successMsg && (
        <div
          className="ac-alert ac-alert-success"
          role="status"
        >
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="ac-alert ac-alert-error" role="alert">
          <XCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {(formError || errorList.length > 0) && !errorMsg && (
        <div className="ac-alert ac-alert-error" role="alert">
          <XCircle size={20} />
          <span>
            {formError ||
              'Please correct the highlighted fields.'}
          </span>
        </div>
      )}

      {createdSummary && (
        <div className="ac-summary" role="status">
          <h3>{TRIP_LABELS[createdSummary.tripType]} is created : </h3>

          <ul>
            {createdSummary.flights.map((flight) => (
              <li key={flight.flightId}>
                <strong>
                  #{flight.flightId} {flight.flightNumber}
                </strong>
                <span>
                  {flight.fromCity} → {flight.toCity}
                </span>
               
                <span>
                  {flight.departureDate} - {flight.departureTime}
                </span>
                <span>{formatINR(flight.price)}</span>
              </li>
            ))}
          </ul>

          {createdSummary.flights.length > 1 && (
            <div className="ac-summary-total">
              Total fare: {formatINR(createdSummary.totalFare)}
            </div>
          )}
        </div>
      )}

      {/* -------------------- Flight Creation Form -------------------- */}

      <form
        id="flightManagementForm"
        className="ac-card"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="ac-tabs-bar">
          <div
            className="ac-tabs"
            role="tablist"
            aria-label="Flight type"
          >
            {TRIP_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                role="tab"
                aria-selected={tripType === type.id}
                className={`ac-tab${
                  tripType === type.id ? ' is-active' : ''
                }`}
                onClick={() => switchTripType(type.id)}
                disabled={
                  submitting ||
                  (editing && tripType !== type.id)
                }
              >
                {type.label}
              </button>
            ))}
          </div>

          {editing && (
            <p className="ac-tabs-note">
              Editing a single flight. Finish or cancel the edit
              to create a round trip or multi-city itinerary.
            </p>
          )}

          {!editing && tripType === 'RoundTrip' && (
            <p className="ac-tabs-note">
              The return flight automatically reverses the outbound
              route and is saved as a separate flight.
            </p>
          )}

          {!editing && tripType === 'MultiCity' && (
            <p className="ac-tabs-note">
              Add {MIN_MULTI_CITY_SEGMENTS}–
              {MAX_MULTI_CITY_SEGMENTS} flights in travel order.
              Each flight starts where the previous one ends unless
              you change it.
            </p>
          )}
        </div>

        <datalist id="supported-flight-cities">
          {SUPPORTED_CITY_NAMES.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>

        {segments.map((segment, index) => (
          <SegmentForm
            key={segment.key}
            segment={segment}
            index={index}
            tripType={tripType}
            errors={errors}
            today={today}
            minDepartureDate={minDepartureFor(index)}
            readOnlyRoute={
              tripType === 'RoundTrip' && index === 1
            }
            canRemove={
              tripType === 'MultiCity' &&
              index >= MIN_MULTI_CITY_SEGMENTS
            }
            disabled={submitting}
            onChange={handleSegmentChange}
            onRemove={removeSegment}
          />
        ))}

        {tripType === 'MultiCity' && (
          <div className="ac-add-row">
            <button
              type="button"
              className="ac-add"
              onClick={addSegment}
              disabled={
                submitting ||
                segments.length >= MAX_MULTI_CITY_SEGMENTS
              }
            >
              <Plus size={16} /> Add Another City/Flight
            </button>

            {segments.length >= MAX_MULTI_CITY_SEGMENTS && (
              <span
                className="ac-hint"
                style={{ marginLeft: 12 }}
              >
                Maximum of {MAX_MULTI_CITY_SEGMENTS} flights reached.
              </span>
            )}
          </div>
        )}

        {tripType !== 'OneWay' && (
          <div className="ac-total" aria-live="polite">
            <span className="ac-total-label">
              {tripType === 'RoundTrip'
                ? 'Total Round-Trip Fare'
                : 'Total Itinerary Fare'}
            </span>

            {totalFare === null ? (
              <span className="ac-total-note">
                Select every route to calculate the total.
              </span>
            ) : (
              <span className="ac-total-value">
                {formatINR(totalFare)}
              </span>
            )}
          </div>
        )}

        <div className="ac-footer">
          <button
            type="button"
            className="ac-btn ac-btn-secondary"
            onClick={handleReset}
            disabled={submitting}
          >
            {editing ? 'Cancel Edit' : 'Reset Form'}
          </button>

          <button
            type="submit"
            id="createFlightBtn"
            className="ac-btn ac-btn-primary"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="ac-spin" />
                <span>
                  {editing ? 'Saving Changes...' : 'Creating...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>{submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* -------------------- Available Flights Table -------------------- */}

      <section className="ac-card ac-list-card">
        <h2>Available Flights</h2>

        {deleteError && !deleteTarget && (
          <p role="alert" className="ac-error">
            {deleteError}
          </p>
        )}

        {flightListLoading ? (
          <p className="ac-hint">Loading flights...</p>
        ) : flightListError ? (
          <p className="ac-error">{flightListError}</p>
        ) : flights.length === 0 ? (
          <p className="ac-hint">No flights found.</p>
        ) : (
          <div
            className="ac-list-scroll"
            role="region"
            aria-label="Available flights table"
            tabIndex={0}
          >
            <table className="ac-flights-table">
              <thead>
                <tr>
                  <th style={{textAlign:'center'}}>Travel Place</th>
                  <th style={{textAlign:'center'}}>Flight Number</th>
                  <th style={{textAlign:'center'}}>Booking Date</th>
                  <th style={{textAlign:'center'}}>Departure Date</th>
                  <th style={{textAlign:'center'}}>Price</th>
                  <th style={{textAlign:'center'}}>Status</th>
                  <th style={{textAlign:'center'}}>Trip Type</th>
                  <th style={{textAlign:'center'}}>Created By</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {sortedFlights.map((flight) => (
                  <tr key={flight.flightId}>
                    <td>
                      <strong>{flight.flightNumber}</strong>
                    </td>

                    <td>
                      {flight.fromCity} → {flight.toCity}
                    </td>

               
               

                    <td>{flight.departureDate || '—'}</td>

                    <td>{flight.departureTime || '—'}</td>

                    <td>{formatINR(flight.price)}</td>

                    <td>
                      <span
                        className={`ac-flight-status ${
                          String(flight.status || '')
                            .toLowerCase()
                            .replace(/\s+/g, '-')
                        }`}
                      >
                        {flight.status || 'Scheduled'}
                      </span>
                    </td>

                    <td>{describeFlight(flight)}</td>

                    <td style={{textAlign:'center'}}>
                      {flight.createdByUserName || '-'}
                    </td>

                    {isAdmin && (
                      <td>
                        <div className="ac-table-actions">
                          <button
                            type="button"
                            className="ac-mini ac-mini-edit"
                            onClick={() => handleEditFlight(flight)}
                            disabled={
                              deletingFlightId !== null ||
                              submitting
                            }
                            aria-label={`Edit flight ${flight.flightNumber}`}
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="ac-mini ac-mini-delete"
                            onClick={() => {
                              setDeleteError('');
                              setDeleteTarget(flight);
                            }}
                            disabled={
                              deletingFlightId !== null ||
                              submitting
                            }
                            aria-label={`Delete flight ${flight.flightNumber}`}
                          >
                            {deletingFlightId === flight.flightId ? (
                              <Loader2
                                size={14}
                                className="ac-spin"
                              />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {flights.length > 10 && !flightListLoading && (
          <p className="ac-hint">
            Showing the 10 newest flights. Older flights are not
            displayed in this list.
          </p>
        )}
      </section>

      {/* -------------------- Delete Confirmation -------------------- */}

      {deleteTarget && (
        <div
          className="ac-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              deletingFlightId === null
            ) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            className="ac-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-flight-confirmation"
          >
            <p id="delete-flight-confirmation">
              Are you sure you want to delete this flight?
            </p>

            {deleteError && (
              <p role="alert" className="ac-dialog-error">
                {deleteError}
              </p>
            )}

            <div className="ac-dialog-actions">
              <button
                type="button"
                className="ac-dialog-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingFlightId !== null}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ac-dialog-delete"
                onClick={handleDeleteFlight}
                disabled={deletingFlightId !== null}
              >
                {deletingFlightId !== null && (
                  <Loader2 size={15} className="ac-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="ac-note">
        Every flight gets its own FlightId from SQL Server. The form
        submits to <code>POST /api/flights/itinerary</code>.
      </p>
    </div>
  );
}
