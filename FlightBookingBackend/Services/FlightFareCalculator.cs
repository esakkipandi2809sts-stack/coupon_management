using System.Text.RegularExpressions;

namespace FlightBookingBackend.Services
{
    public static class FlightFareCalculator
    {
        public const decimal FarePerKilometer = 4m;
        public const decimal MinimumEconomyFare = 1500m;

        public static decimal CalculateBaseFare(decimal distanceKm, string? flightClass)
        {
            return CalculateClassFare(CalculateEconomyFare(distanceKm), flightClass);
        }

        public static decimal CalculateBaseFare(decimal distanceKm, string? departureTime, string? flightNumber, string? airline, string? flightClass)
        {
            return CalculateClassFare(CalculateEconomyFare(distanceKm, departureTime, flightNumber, airline), flightClass);
        }

        public static decimal CalculateEconomyFare(decimal distanceKm)
        {
            if (distanceKm <= 0m)
            {
                throw new ArgumentOutOfRangeException(nameof(distanceKm), "Route distance must be greater than zero.");
            }

            return Math.Round(Math.Max(distanceKm * FarePerKilometer, MinimumEconomyFare), 0, MidpointRounding.AwayFromZero);
        }

        /// <summary>
        /// Calculates dynamic flight fare based on route distance, departure time, and flight-specific characteristics.
        /// Fares vary across departure time slots (morning/evening peaks vs. afternoon valleys vs. red-eye night)
        /// and each flight receives a deterministic, distinct fare based on its flight number and carrier.
        /// </summary>
        public static decimal CalculateEconomyFare(decimal distanceKm, string? departureTime, string? flightNumber = null, string? airline = null)
        {
            var baseEconomy = CalculateEconomyFare(distanceKm);

            if (string.IsNullOrWhiteSpace(departureTime))
            {
                return baseEconomy;
            }

            var timeMultiplier = GetDepartureTimeMultiplier(departureTime);
            var flightVariance = GetFlightVarianceMultiplier(departureTime, flightNumber, airline);

            var dynamicFare = baseEconomy * timeMultiplier * flightVariance;

            var rounded = Math.Round(dynamicFare / 10m, 0, MidpointRounding.AwayFromZero) * 10m;
            return Math.Max(rounded, MinimumEconomyFare);
        }

        public static decimal ResolveBaseFare(decimal? distanceKm)
        {
            if (distanceKm is > 0m)
            {
                return CalculateEconomyFare(distanceKm.Value);
            }
            return 0m;
        }

        public static decimal ResolveBaseFare(decimal? distanceKm, string? departureTime, string? flightNumber = null, string? airline = null)
        {
            if (distanceKm is > 0m)
            {
                return CalculateEconomyFare(distanceKm.Value, departureTime, flightNumber, airline);
            }
            return 0m;
        }

        public static decimal GetDepartureTimeMultiplier(string? departureTime)
        {
            var parsed = TryParseTime(departureTime);
            if (!parsed.HasValue)
            {
                return 1.0m;
            }

            var hour = parsed.Value.Hour;

            // Airline dynamic pricing departure bands:
            // 23:00 - 04:59 : Late Night / Red-Eye (low demand, off-peak discount)
            // 05:00 - 07:59 : Early Morning (business commute wave 1)
            // 08:00 - 11:59 : Morning Peak (highest demand morning hours)
            // 12:00 - 15:59 : Midday / Afternoon (leisure valley)
            // 16:00 - 19:59 : Evening Peak (prime return / rush hour)
            // 20:00 - 22:59 : Late Evening (post-work / evening arrivals)
            return hour switch
            {
                >= 5 and < 8 => 1.10m,
                >= 8 and < 12 => 1.20m,
                >= 12 and < 16 => 0.95m,
                >= 16 and < 20 => 1.25m,
                >= 20 and < 23 => 1.05m,
                _ => 0.85m
            };
        }

        public static decimal GetFlightVarianceMultiplier(string? departureTime, string? flightNumber, string? airline)
        {
            decimal variance = 1.0m;

            // 1. Minute variance: (minute % 15 - 7) * 0.004m (-2.8% to +2.8%)
            var parsed = TryParseTime(departureTime);
            if (parsed.HasValue)
            {
                var minute = parsed.Value.Minute;
                variance += ((minute % 15) - 7) * 0.004m;
            }

            // 2. Carrier tier modifier
            if (!string.IsNullOrWhiteSpace(airline))
            {
                var normAirline = airline.Trim().ToLowerInvariant();
                if (normAirline.Contains("british") || normAirline.Contains("air india") ||
                    normAirline.Contains("emirates") || normAirline.Contains("qantas") ||
                    normAirline.Contains("virgin") || normAirline.Contains("singapore") ||
                    normAirline.Contains("american") || normAirline.Contains("delta") ||
                    normAirline.Contains("united") || normAirline.Contains("air france") ||
                    normAirline.Contains("all nippon") || normAirline.Contains("japan airlines"))
                {
                    variance += 0.04m; // Full service / international premium
                }
                else if (normAirline.Contains("indigo"))
                {
                    variance += 0.01m; // Primary low-cost carrier
                }
                else if (normAirline.Contains("spicejet") || normAirline.Contains("akasa") || normAirline.Contains("goair"))
                {
                    variance -= 0.03m; // Budget value carrier
                }
            }

            // 3. Flight number hash variance: distinct offset per flight (-6.4% to +6.4%)
            if (!string.IsNullOrWhiteSpace(flightNumber))
            {
                int seed = 0;
                foreach (char c in flightNumber.Trim())
                {
                    if (char.IsDigit(c))
                        seed = (seed * 10) + (c - '0');
                    else
                        seed += c;
                }
                var seedOffset = ((seed % 17) - 8) * 0.008m;
                variance += seedOffset;
            }

            // Keep flight variance in a balanced, realistic range [0.90, 1.15]
            return Math.Clamp(variance, 0.90m, 1.15m);
        }

        public static (int Hour, int Minute)? TryParseTime(string? timeStr)
        {
            if (string.IsNullOrWhiteSpace(timeStr)) return null;

            var trimmed = timeStr.Trim();

            // Try standard time parsing
            if (DateTime.TryParse(trimmed, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.NoCurrentDateDefault, out var dt))
            {
                return (dt.Hour, dt.Minute);
            }

            if (TimeOnly.TryParse(trimmed, out var t))
            {
                return (t.Hour, t.Minute);
            }

            // Try regex for "hh:mm", "hh:mm AM/PM", "h:mm am/pm"
            var match = Regex.Match(trimmed, @"^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?");
            if (match.Success)
            {
                var hour = int.Parse(match.Groups[1].Value);
                var minute = int.Parse(match.Groups[2].Value);
                var ampm = match.Groups[3].Value.ToUpperInvariant();

                if (ampm == "PM" && hour < 12) hour += 12;
                if (ampm == "AM" && hour == 12) hour = 0;

                if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)
                {
                    return (hour, minute);
                }
            }

            return null;
        }

        public static decimal CalculateClassFare(decimal baseFare, string? flightClass)
        {
            if (baseFare <= 0m)
            {
                throw new ArgumentOutOfRangeException(nameof(baseFare), "Economy fare must be greater than zero.");
            }

            decimal classMultiplier = NormalizeClass(flightClass) switch
            {
                "Economy" => 1m,
                "Premium Economy" => 1.3m,
                "Business" => 1.5m,
                "First" => 2.2m,
                _ => throw new ArgumentException("Travel class must be All, Economy, Premium Economy, Business, or First.", nameof(flightClass))
            };

            return Math.Round(baseFare * classMultiplier, 0, MidpointRounding.AwayFromZero);
        }

        public static bool IsSupportedClass(string? flightClass)
        {
            return flightClass?.Trim().ToLowerInvariant() is "all" or "economy" or "premium economy" or "business" or "first" or "first class";
        }

        private static string NormalizeClass(string? flightClass)
        {
            return flightClass?.Trim().ToLowerInvariant() switch
            {
                "all" or "economy" => "Economy",
                "premium economy" => "Premium Economy",
                "business" => "Business",
                "first" or "first class" => "First",
                _ => throw new ArgumentException("Travel class must be All, Economy, Premium Economy, Business, or First Class.", nameof(flightClass))
            };
        }
    }
}
