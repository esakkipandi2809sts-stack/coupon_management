namespace FlightBookingBackend.Services
{
    public static class AirlineClassCouponCalculator
    {
        // Rate table for airline and traveller class combinations
        private static readonly Dictionary<(string Airline, string Class), decimal> CombinationRates =
            new(AirlineClassComparer.Instance)
            {
                { ("IndiGo", "Business"), 2m },
                { ("Spice Jet", "Business"), 1m },
                { ("IndiGo", "Economy"), 2m },
                { ("Spice Jet", "First"), 1m },
                { ("British Airways", "Business"), 2m },
                { ("British Airways", "Economy"), 1m },

                // Additional supported airline and class combinations
                { ("IndiGo", "Premium Economy"), 2m },
                { ("IndiGo", "First"), 2m },
                { ("Spice Jet", "Economy"), 1m },
                { ("Spice Jet", "Premium Economy"), 1m },
                { ("British Airways", "First"), 2m },
                { ("British Airways", "Premium Economy"), 1m },
                { ("Air India", "Business"), 2m },
                { ("Air India", "Economy"), 1m },
                { ("Air India", "First"), 2m },
                { ("Air India", "Premium Economy"), 1m },
            };

        public static decimal GetPercentage(string? airline, string? travellerClass)
        {
            var normalizedAirline = NormalizeAirline(airline);
            var normalizedClass = NormalizeClass(travellerClass);

            if (CombinationRates.TryGetValue((normalizedAirline, normalizedClass), out var rate))
            {
                return rate;
            }

            // Default fallback for any additional or unlisted airline
            return 1m;
        }

        public static void RegisterCombination(string airline, string travellerClass, decimal percentage)
        {
            var normalizedAirline = NormalizeAirline(airline);
            var normalizedClass = NormalizeClass(travellerClass);
            CombinationRates[(normalizedAirline, normalizedClass)] = percentage;
        }

        public static int CalculatePoints(decimal totalPassengerFare, decimal percentage)
        {
            if (totalPassengerFare <= 0m || percentage <= 0m)
            {
                return 0;
            }

            // Points = (Total Passenger Fare × Percentage) / 100
            // All flight fares, passenger totals, coupon discounts, and final payable amounts must be integers.
            return (int)Math.Round((totalPassengerFare * percentage) / 100m, 0, MidpointRounding.AwayFromZero);
        }

        public static int CalculateDiscount(int points)
        {
            if (points <= 0)
            {
                return 0;
            }

            // Discount = Points / 10
            return (int)Math.Round(points / 10m, 0, MidpointRounding.AwayFromZero);
        }

        public static int CalculateFinalFare(int totalPassengerFare, int discount)
        {
            // Final Fare = Total Passenger Fare - Discount
            return Math.Max(0, totalPassengerFare - discount);
        }

        public static string NormalizeAirline(string? airline)
        {
            if (string.IsNullOrWhiteSpace(airline)) return "Unknown";
            var trimmed = airline.Trim();
            if (trimmed.Equals("IndiGo", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals("Indigo", StringComparison.OrdinalIgnoreCase))
                return "IndiGo";
            if (trimmed.Equals("Spice Jet", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals("Spice Jet", StringComparison.OrdinalIgnoreCase))
                return "Spice Jet";
            if (trimmed.Equals("British Airways", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals("BritishAirways", StringComparison.OrdinalIgnoreCase))
                return "British Airways";
            if (trimmed.Equals("Air India", StringComparison.OrdinalIgnoreCase) ||
                trimmed.Equals("AirIndia", StringComparison.OrdinalIgnoreCase))
                return "Air India";

            return trimmed;
        }

        public static string NormalizeClass(string? travellerClass)
        {
            if (string.IsNullOrWhiteSpace(travellerClass)) return "Economy";
            return travellerClass.Trim().ToLowerInvariant() switch
            {
                "all" or "economy" => "Economy",
                "premium economy" => "Premium Economy",
                "business" => "Business",
                "first" or "first class" => "First",
                _ => "Economy"
            };
        }

        private sealed class AirlineClassComparer : IEqualityComparer<(string Airline, string Class)>
        {
            public static readonly AirlineClassComparer Instance = new();

            public bool Equals((string Airline, string Class) x, (string Airline, string Class) y)
            {
                return string.Equals(NormalizeAirline(x.Airline), NormalizeAirline(y.Airline), StringComparison.OrdinalIgnoreCase) &&
                       string.Equals(NormalizeClass(x.Class), NormalizeClass(y.Class), StringComparison.OrdinalIgnoreCase);
            }

            public int GetHashCode((string Airline, string Class) obj)
            {
                return HashCode.Combine(
                    NormalizeAirline(obj.Airline).ToUpperInvariant(),
                    NormalizeClass(obj.Class).ToUpperInvariant());
            }
        }
    }
}
