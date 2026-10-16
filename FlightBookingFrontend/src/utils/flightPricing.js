const FARE_PER_KILOMETER = 10;
const MINIMUM_ECONOMY_FARE = 1500;

export function calculateEconomyFare(distanceKm) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return null;
  return Math.round(Math.max(distance * FARE_PER_KILOMETER, MINIMUM_ECONOMY_FARE));
}

export function getClassMultiplier(flightClass) {
  const normalizedClass = flightClass === 'All' ? 'Economy' : flightClass;
  return {
    Economy: 1,
    'Premium Economy': 1.3,
    Business: 1.5,
    First: 2.2,
    'First Class': 2.2,
  }[normalizedClass] ?? null;
}

export function calculateClassFare(economyFare, flightClass) {
  const baseFare = Number(economyFare);
  if (!Number.isFinite(baseFare) || baseFare <= 0) return null;

  const multiplier = getClassMultiplier(flightClass);
  if (multiplier === null) return null;
  return Math.round(baseFare * multiplier);
}

export function formatINR(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  return `₹${rounded.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

// Total fare of an itinerary = sum of each segment's economy fare (same per-flight formula everywhere).
export function calculateItineraryFare(distancesKm) {
  let total = 0;
  for (const distance of distancesKm) {
    const fare = calculateEconomyFare(distance);
    if (fare === null) return null;
    total += fare;
  }
  return Math.round(total);
}

// Airline and traveller class-based coupon points percentage mapping
export function getAirlineClassPercentage(airline, flightClass) {
  const normAirline = (airline || '').trim().toLowerCase();
  const normClass = (flightClass === 'All' ? 'Economy' : flightClass || '').trim().toLowerCase();

  // IndiGo Business – 2%
  if (normAirline === 'indigo' && normClass === 'business') return 2;
  // SpiceJet Business – 1%
  if (normAirline === 'spicejet' && normClass === 'business') return 1;
  // IndiGo Economy – 2%
  if (normAirline === 'indigo' && normClass === 'economy') return 2;
  // SpiceJet First – 1%
  if (normAirline === 'spicejet' && (normClass === 'first' || normClass === 'first class')) return 1;
  // British Airways Business – 2%
  if (normAirline.includes('british') && normClass === 'business') return 2;
  // British Airways Economy – 1%
  if (normAirline.includes('british') && normClass === 'economy') return 1;

  // Additional combinations
  if (normAirline === 'indigo') return 2;
  if (normAirline === 'spicejet') return 1;
  if (normAirline.includes('british')) {
    return normClass === 'first' || normClass === 'business' ? 2 : 1;
  }
  if (normAirline.includes('air india')) {
    return normClass === 'business' || normClass === 'first' ? 2 : 1;
  }

  return 1;
}

export function calculateCouponPoints(totalPassengerFare, percentage) {
  const fare = Number(totalPassengerFare) || 0;
  const pct = Number(percentage) || 0;
  return Math.round((fare * pct) / 100);
}

export function calculateCouponDiscount(points) {
  const pts = Number(points) || 0;
  return Math.round(pts / 10);
}

export function calculateFinalFare(totalPassengerFare, discount) {
  const fare = Number(totalPassengerFare) || 0;
  const disc = Number(discount) || 0;
  return Math.max(0, Math.round(fare - disc));
}
