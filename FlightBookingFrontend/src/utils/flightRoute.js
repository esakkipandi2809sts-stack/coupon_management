// Route helpers shared by flight creation and booking. The city table mirrors
// FlightBookingBackend/Services/RouteDistanceCalculator.cs.
// Fares are NOT calculated here: use calculateEconomyFare() from ./flightPricing.

// Realistic commercial aircraft cruise speeds (km/h) for domestic jet aircraft:
// Optimal cruising speed ~800 km/h, conservative speed / headwinds ~720 km/h.
// Flight buffer accounts for taxi-out, takeoff roll, climb, descent, approach, and taxi-in (~30-35 mins).
const CRUISE_SPEED_HIGH_KMH = 800;
const CRUISE_SPEED_LOW_KMH = 720;
const FLIGHT_BUFFER_MINUTES = 33;

export const DEFAULT_DEPARTURE_TIME = '09:00';

export const CITY_COORDINATES = {
  ahmedabad: [23.0225, 72.5714],
  amritsar: [31.634, 74.8723],
  bengaluru: [12.9716, 77.5946],
  bhopal: [23.2599, 77.4126],
  bhubaneswar: [20.2961, 85.8245],
  chandigarh: [30.7333, 76.7794],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  dehradun: [30.3165, 78.0322],
  delhi: [28.6139, 77.209],
  goa: [15.2993, 74.124],
  guwahati: [26.1445, 91.7362],
  hyderabad: [17.385, 78.4867],
  indore: [22.7196, 75.8577],
  jaipur: [26.9124, 75.7873],
  jammu: [32.7266, 74.857],
  kochi: [9.9312, 76.2673],
  kolkata: [22.5726, 88.3639],
  lucknow: [26.8467, 80.9462],
  ludhiana: [30.901, 75.8573],
  madurai: [9.9252, 78.1198],
  mangalore: [12.9141, 74.856],
  mumbai: [19.076, 72.8777],
  mysuru: [12.2958, 76.6394],
  nagpur: [21.1458, 79.0882],
  patna: [25.5941, 85.1376],
  pondicherry: [11.9416, 79.8083],
  prayagraj: [25.4358, 81.8463],
  pune: [18.5204, 73.8567],
  raipur: [21.2514, 81.6296],
  ranchi: [23.3441, 85.3096],
  surat: [21.1702, 72.8311],
  thiruvananthapuram: [8.5241, 76.9366],
  tiruchirappalli: [10.7905, 78.7047],
  udaipur: [24.5854, 73.7125],
  vadodara: [22.3072, 73.1812],
  varanasi: [25.3176, 82.9739],
  vijayawada: [16.5062, 80.648],
  visakhapatnam: [17.6868, 83.2185],
};

const CITY_ALIASES = {
  bangalore: 'bengaluru',
  calicut: 'kochi',
  kozhikode: 'kochi',
  trivandrum: 'thiruvananthapuram',
  trichy: 'tiruchirappalli',
  vizag: 'visakhapatnam',
};

export const SUPPORTED_CITY_NAMES = Object.keys(CITY_COORDINATES).map((city) =>
  city.replace(/\b\w/g, (letter) => letter.toUpperCase()),
);

export const normalizeCity = (city) => String(city ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export const isSameCity = (a, b) => {
  const first = normalizeCity(a);
  return first !== '' && first === normalizeCity(b);
};

function getCoordinates(city) {
  const normalized = normalizeCity(city);
  const canonical = CITY_ALIASES[normalized] || normalized;
  return CITY_COORDINATES[canonical];
}

/**
 * Calculates approximate great-circle distance between two cities in kilometers.
 * Distances >= 100 km are rounded to the nearest 10 km (e.g. Chennai to Delhi ~ 1,760 km).
 */
export function calculateRouteDistance(fromCity, toCity) {
  const from = getCoordinates(fromCity);
  const to = getCoordinates(toCity);
  if (!from || !to) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const [fromLatitude, fromLongitude] = from.map(radians);
  const [toLatitude, toLongitude] = to.map(radians);
  const latitudeDelta = toLatitude - fromLatitude;
  const longitudeDelta = toLongitude - fromLongitude;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const greatCircleDistance = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  if (greatCircleDistance <= 0) return null;

  const distance = greatCircleDistance >= 100
    ? Math.round(greatCircleDistance / 10) * 10
    : Math.round(greatCircleDistance);

  return distance > 0 ? distance : null;
}

/**
 * Calculates the min and max flight duration minutes based on distance and realistic aircraft speed.
 * Rounded to the nearest 5 minutes.
 */
export function getFlightDurationRangeMinutes(distanceKm) {
  const dist = Number(distanceKm);
  if (!Number.isFinite(dist) || dist <= 0) return { minMinutes: 0, maxMinutes: 0 };
  const minMin = Math.round(((dist / CRUISE_SPEED_HIGH_KMH) * 60 + FLIGHT_BUFFER_MINUTES) / 5) * 5;
  const maxMin = Math.round(((dist / CRUISE_SPEED_LOW_KMH) * 60 + FLIGHT_BUFFER_MINUTES) / 5) * 5;
  return { minMinutes: Math.max(30, minMin), maxMinutes: Math.max(minMin, maxMin) };
}

/**
 * Returns average flight duration in minutes for arrival schedule calculations.
 */
export function getDurationMinutes(distanceKm) {
  const { minMinutes, maxMinutes } = getFlightDurationRangeMinutes(distanceKm);
  if (!minMinutes && !maxMinutes) return 45;
  return Math.round((minMinutes + maxMinutes) / 2);
}

/**
 * Formats minutes into hours and minutes, e.g. "2 hr 45 min", "45 min".
 */
export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} hr`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} min`);
  return parts.join(' ') || '0 min';
}

/**
 * Formats duration based on distance and realistic aircraft speed, e.g. "2 hr 45 min".
 */
export function formatDurationRange(distanceKm) {
  const { minMinutes } = getFlightDurationRangeMinutes(distanceKm);
  if (!minMinutes) return '';
  return formatMinutes(minMinutes);
}

/**
 * Backwards compatible duration formatter. If given a range or number of minutes, formats cleanly.
 */
export function formatDuration(durationOrMinutes) {
  if (typeof durationOrMinutes === 'string') {
    return normalizeDurationDisplay(durationOrMinutes);
  }
  return formatMinutes(durationOrMinutes);
}

/**
 * Formats distance in kilometers as a clean badge: e.g. "990 km" or "1,760 km".
 */
export function formatDistanceKm(distanceKm) {
  const dist = Number(distanceKm);
  if (!Number.isFinite(dist) || dist <= 0) return '';
  return `${Math.round(dist).toLocaleString()} km`;
}

/**
 * Formats distance in kilometers: e.g. "Approximately 1,760 km".
 */
export function formatDistance(distanceKm) {
  const dist = Number(distanceKm);
  if (!Number.isFinite(dist) || dist <= 0) return 'Distance unavailable';
  return `Approximately ${Math.round(dist).toLocaleString()} km`;
}

/**
 * Formats stops in authentic airline booking format: "Non-stop", "1 Stop", "2 Stops".
 */
export function formatStops(stopCount) {
  const count = Number(stopCount);
  if (!Number.isFinite(count) || count <= 0) return 'Non-stop';
  if (count === 1) return '1 Stop';
  return `${count} Stops`;
}

/**
 * Standard 3-letter IATA airport codes for major Indian and international destinations.
 */
export const CITY_AIRPORT_CODES = {
  delhi: 'DEL',
  mumbai: 'BOM',
  bengaluru: 'BLR',
  bangalore: 'BLR',
  chennai: 'MAA',
  kolkata: 'CCU',
  hyderabad: 'HYD',
  goa: 'GOI',
  ahmedabad: 'AMD',
  pune: 'PNQ',
  kochi: 'COK',
  calicut: 'CCJ',
  thiruvananthapuram: 'TRV',
  trivandrum: 'TRV',
  jaipur: 'JAI',
  lucknow: 'LKO',
  chandigarh: 'IXC',
  amritsar: 'ATQ',
  guwahati: 'GAU',
  patna: 'PAT',
  bhubaneswar: 'BBI',
  indore: 'IDR',
  varanasi: 'VNS',
  coimbatore: 'CJB',
  madurai: 'IXM',
  tiruchirappalli: 'TRZ',
  trichy: 'TRZ',
  mangalore: 'IXE',
  visakhapatnam: 'VTZ',
  vizag: 'VTZ',
  dehradun: 'DED',
  ranchi: 'IXR',
  raipur: 'RPR',
  surat: 'STV',
  vadodara: 'BDQ',
  bhopal: 'BHO',
  udaipur: 'UDR',
  jammu: 'IXJ',
  srinagar: 'SXR',
};

/**
 * Resolves standard 3-letter airport code for a city.
 */
export function getAirportCode(city, existingCode) {
  const code = String(existingCode || '').trim().toUpperCase();
  if (code.length === 3 && /^[A-Z]{3}$/.test(code)) {
    return code;
  }
  const norm = normalizeCity(city);
  const alias = CITY_ALIASES[norm] || norm;
  return CITY_AIRPORT_CODES[alias] || CITY_AIRPORT_CODES[norm] || (city ? city.slice(0, 3).toUpperCase() : 'APT');
}

/**
 * Determines stop count as a valid non-negative integer.
 */
export function determineStopCount(flightOrSegment) {
  const val = flightOrSegment?.stopCount;
  if (val !== undefined && val !== null && val !== '') {
    const num = Number(val);
    if (Number.isFinite(num) && num >= 0) return Math.floor(num);
  }
  return 0;
}

/**
 * Determines flight type based on stop count:
 * - Stop Count 0: Direct
 * - Stop Count > 0: Connecting
 */
export function determineFlightType(stopCount) {
  const count = Number(stopCount);
  return Number.isFinite(count) && count > 0 ? 'Connecting' : 'Direct';
}

/**
 * Normalizes duration string to ensure standard MakeMyTrip format in hours and minutes (e.g. 2h 15m).
 */
export function normalizeDurationDisplay(text, distanceKm) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed === '0m' || trimmed === '0 min') {
    return distanceKm ? formatDurationRange(distanceKm) : 'Duration unavailable';
  }

  // E.g. "135" or "135m"
  if (/^\d+$/.test(trimmed)) {
    const mins = parseInt(trimmed, 10);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(' ') || '0m';
  }

  const rangeMatch = trimmed.match(/^(.+?)\s*[–-]\s*(.+)$/);
  if (rangeMatch) {
    return normalizeDurationDisplay(rangeMatch[1]);
  }

  const match = trimmed.match(/^(?:(\d+)\s*(?:h|hr|hrs|hours?))?\s*(?:(\d+)\s*(?:m|min|mins|minutes?))?$/i);
  if (match && (match[1] || match[2])) {
    const hours = match[1] ? Number(match[1]) : 0;
    const mins = match[2] ? Number(match[2]) : 0;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    return parts.join(' ') || '0m';
  }

  return trimmed;
}

/**
 * Validates that a duration string is in a recognized, positive format
 * e.g. "2h 15m", "2h", "45m", "2 hr 15 min", "135m".
 */
export function isValidDuration(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) > 0;
  }
  const match = trimmed.match(/^(?:(\d+)\s*(?:h|hr|hrs|hours?))?\s*(?:(\d+)\s*(?:m|min|mins|minutes?))?$/i);
  if (match && (match[1] || match[2])) {
    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    return hours * 60 + minutes > 0;
  }
  return false;
}

/**
 * Returns complete flight details object with calculated distance, stop count,
 * flight type and duration in the expected format.
 * Manually entered duration is always prioritized over distance-based estimates.
 */
export function getFlightDetails(flightOrSegment) {
  const fromCity = String(flightOrSegment?.fromCity || '').trim();
  const toCity = String(flightOrSegment?.toCity || '').trim();

  let distanceKm = null;
  if (fromCity && toCity) {
    distanceKm = calculateRouteDistance(fromCity, toCity);
  }
  if (!distanceKm) {
    const rawDist = Number(flightOrSegment?.distanceKm);
    if (Number.isFinite(rawDist) && rawDist > 0) {
      distanceKm = rawDist;
    }
  }

  const stopCount = determineStopCount(flightOrSegment);
  const flightType = determineFlightType(stopCount);

  let durationDisplay = '';
  if (flightOrSegment?.duration && String(flightOrSegment.duration).trim()) {
    durationDisplay = normalizeDurationDisplay(flightOrSegment.duration);
  }
  if (!durationDisplay && distanceKm) {
    durationDisplay = formatDurationRange(distanceKm);
  }

  const distanceDisplay = distanceKm > 0 ? formatDistance(distanceKm) : 'Distance unavailable';

  return {
    fromCity,
    toCity,
    distanceKm: distanceKm > 0 ? distanceKm : null,
    distanceDisplay,
    stopCount,
    flightType,
    duration: durationDisplay || 'Duration unavailable',
  };
}

export function calculateArrival(departureDate, departureTime, durationMinutes) {
  if (!departureTime || !Number.isFinite(durationMinutes)) {
    return { arrivalDate: '', arrivalTime: '' };
  }

  const [hours, minutes] = departureTime.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return { arrivalDate: '', arrivalTime: '' };
  }

  const totalMinutes = hours * 60 + minutes + Math.round(durationMinutes);
  const arrivalTime = `${String(Math.floor((totalMinutes % 1440) / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  let arrivalDate = departureDate;

  if (departureDate) {
    const [year, month, day] = departureDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + Math.floor(totalMinutes / 1440)));
    arrivalDate = date.toISOString().slice(0, 10);
  }

  return { arrivalDate, arrivalTime };
}

/** Combine a YYYY-MM-DD date and HH:mm time into a comparable timestamp (ms), or NaN. */
export function toTimestamp(date, time) {
  if (!date || !time) return NaN;
  return new Date(`${date}T${time}:00`).getTime();
}

/**
 * Calculates duration automatically between departure and arrival times (and optional dates).
 * Returns standard format e.g. "2h 15m", "2h", "45m", or "" if invalid/incomplete.
 */
export function calculateDuration(departureTime, arrivalTime, departureDate, arrivalDate) {
  if (!departureTime || !arrivalTime) return '';

  const depTrimmed = String(departureTime).trim();
  const arrTrimmed = String(arrivalTime).trim();

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
  if (!timeRegex.test(depTrimmed) || !timeRegex.test(arrTrimmed)) {
    return '';
  }

  // If both departureDate and arrivalDate are provided, calculate difference using timestamps
  if (departureDate && arrivalDate) {
    const depMs = toTimestamp(departureDate, depTrimmed);
    const arrMs = toTimestamp(arrivalDate, arrTrimmed);
    if (!Number.isNaN(depMs) && !Number.isNaN(arrMs) && arrMs > depMs) {
      const totalMinutes = Math.round((arrMs - depMs) / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0) parts.push(`${mins}m`);
      return parts.join(' ') || '0m';
    }
  }

  // Calculate difference from times directly
  const [depH, depM] = depTrimmed.split(':').map(Number);
  const [arrH, arrM] = arrTrimmed.split(':').map(Number);
  if (!Number.isFinite(depH) || !Number.isFinite(depM) || !Number.isFinite(arrH) || !Number.isFinite(arrM)) {
    return '';
  }

  let totalMinutes = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60; // Overnight flight crossing midnight
  } else if (totalMinutes === 0) {
    return '';
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.join(' ') || '0m';
}

/**
 * Recalculates route distance, stop count, flight type, and duration for a segment.
 * Duration is automatically calculated from Departure Time and Arrival Time whenever available.
 */
export function recalculateSegment(segment) {
  const next = { ...segment };
  const { fromCity, toCity, departureTime, arrivalTime, departureDate, arrivalDate } = next;

  const currentStopCount = determineStopCount(next);
  const currentFlightType = determineFlightType(currentStopCount);

  const autoDuration = calculateDuration(departureTime, arrivalTime, departureDate, arrivalDate);
  if (autoDuration) {
    next.duration = autoDuration;
  }

  if (!fromCity.trim() || !toCity.trim()) {
    return {
      ...next,
      distanceKm: '',
      stopCount: currentStopCount,
      flightType: currentFlightType,
    };
  }

  const distanceKm = isSameCity(fromCity, toCity) ? null : calculateRouteDistance(fromCity, toCity);
  if (distanceKm === null) {
    return {
      ...next,
      distanceKm: '',
      stopCount: currentStopCount,
      flightType: currentFlightType,
    };
  }

  return {
    ...next,
    distanceKm: String(distanceKm),
    stopCount: currentStopCount,
    flightType: currentFlightType,
  };
}
