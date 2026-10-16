// Route helpers shared by flight creation. The city table and the distance formula mirror
// FlightBookingBackend/Services/RouteDistanceCalculator.cs (great-circle distance x 1.1 routing
// allowance), so the distance shown in the form is the one the server stores.
// Fares are NOT calculated here: use calculateEconomyFare() from ./flightPricing.

const CRUISE_SPEED_KMH = 750;
const ROUTING_ALLOWANCE = 1.1;

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
  const distance = Math.round(greatCircleDistance * ROUTING_ALLOWANCE * 10) / 10;
  return distance > 0 ? distance : null;
}

export function getDurationMinutes(distanceKm) {
  return Math.max(45, Math.round((distanceKm / CRUISE_SPEED_KMH) * 60 + 35));
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours ? `${hours}h` : '', remainingMinutes ? `${remainingMinutes}m` : '']
    .filter(Boolean)
    .join(' ') || '0m';
}

export function calculateArrival(departureDate, departureTime, durationMinutes) {
  if (!departureTime || !Number.isFinite(durationMinutes)) {
    return { arrivalDate: '', arrivalTime: '' };
  }

  const [hours, minutes] = departureTime.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return { arrivalDate: '', arrivalTime: '' };
  }

  const totalMinutes = hours * 60 + minutes + durationMinutes;
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
 * Recalculates distance, duration and arrival for a segment from its current cities,
 * departure date and departure time. Returns a new segment object.
 */
export function recalculateSegment(segment) {
  const next = { ...segment };
  const { fromCity, toCity } = next;

  if (!fromCity.trim() || !toCity.trim()) {
    return { ...next, distanceKm: '', arrivalDate: '', arrivalTime: '', duration: '' };
  }

  if (!next.departureTime) next.departureTime = DEFAULT_DEPARTURE_TIME;

  const distanceKm = isSameCity(fromCity, toCity) ? null : calculateRouteDistance(fromCity, toCity);
  if (distanceKm === null) {
    return { ...next, distanceKm: '', arrivalDate: '', arrivalTime: '', duration: '' };
  }

  const durationMinutes = getDurationMinutes(distanceKm);
  const arrival = calculateArrival(next.departureDate, next.departureTime, durationMinutes);
  return {
    ...next,
    distanceKm: String(distanceKm),
    duration: formatDuration(durationMinutes),
    arrivalDate: arrival.arrivalDate,
    arrivalTime: arrival.arrivalTime,
  };
}
