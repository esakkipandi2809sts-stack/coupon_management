const FARE_PER_KILOMETER = 4;
const MINIMUM_ECONOMY_FARE = 1500;

export function tryParseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = (match[3] || '').toUpperCase();

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
    return { hour, minute };
  }
  return null;
}

export function getDepartureTimeMultiplier(departureTime) {
  const parsed = tryParseTime(departureTime);
  if (!parsed) return 1.0;

  const { hour } = parsed;
  // Dynamic pricing departure time bands:
  // 23:00 - 04:59 : Late Night / Red-Eye (low demand, off-peak discount)
  // 05:00 - 07:59 : Early Morning (business commute wave 1)
  // 08:00 - 11:59 : Morning Peak (highest demand morning hours)
  // 12:00 - 15:59 : Midday / Afternoon (leisure valley)
  // 16:00 - 19:59 : Evening Peak (prime return / rush hour)
  // 20:00 - 22:59 : Late Evening (post-work / evening arrivals)
  if (hour >= 5 && hour < 8) return 1.10;
  if (hour >= 8 && hour < 12) return 1.20;
  if (hour >= 12 && hour < 16) return 0.95;
  if (hour >= 16 && hour < 20) return 1.25;
  if (hour >= 20 && hour < 23) return 1.05;
  return 0.85;
}

export function getFlightVarianceMultiplier(departureTime, flightNumber, airline) {
  let variance = 1.0;

  const parsed = tryParseTime(departureTime);
  if (parsed) {
    variance += ((parsed.minute % 15) - 7) * 0.004;
  }

  if (airline && typeof airline === 'string') {
    const norm = airline.trim().toLowerCase();
    if (
      norm.includes('british') || norm.includes('air india') ||
      norm.includes('emirates') || norm.includes('qantas') ||
      norm.includes('virgin') || norm.includes('singapore') ||
      norm.includes('american') || norm.includes('delta') ||
      norm.includes('united') || norm.includes('air france') ||
      norm.includes('all nippon') || norm.includes('japan airlines')
    ) {
      variance += 0.04;
    } else if (norm.includes('indigo')) {
      variance += 0.01;
    } else if (norm.includes('spicejet') || norm.includes('akasa') || norm.includes('goair')) {
      variance -= 0.03;
    }
  }

  if (flightNumber && typeof flightNumber === 'string') {
    let seed = 0;
    for (const c of flightNumber.trim()) {
      if (c >= '0' && c <= '9') {
        seed = (seed * 10) + parseInt(c, 10);
      } else {
        seed += c.charCodeAt(0);
      }
    }
    const seedOffset = ((seed % 17) - 8) * 0.008;
    variance += seedOffset;
  }

  return Math.min(1.15, Math.max(0.90, variance));
}

export function calculateEconomyFare(distanceKm, departureTime = null, flightNumber = null, airline = null) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return null;

  const baseEconomy = Math.max(distance * FARE_PER_KILOMETER, MINIMUM_ECONOMY_FARE);
  if (!departureTime) {
    return Math.round(baseEconomy);
  }

  const timeMultiplier = getDepartureTimeMultiplier(departureTime);
  const flightVariance = getFlightVarianceMultiplier(departureTime, flightNumber, airline);

  const dynamicFare = baseEconomy * timeMultiplier * flightVariance;
  const rounded = Math.round(dynamicFare / 10) * 10;
  return Math.max(rounded, MINIMUM_ECONOMY_FARE);
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
