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

        public static decimal CalculateEconomyFare(decimal distanceKm)
        {
            if (distanceKm <= 0m)
            {
                throw new ArgumentOutOfRangeException(nameof(distanceKm), "Route distance must be greater than zero.");
            }

            return Math.Round(Math.Max(distanceKm * FarePerKilometer, MinimumEconomyFare), 0, MidpointRounding.AwayFromZero);
        }

        public static decimal ResolveBaseFare(decimal? distanceKm)
        {
            if (distanceKm is > 0m)
            {
                return CalculateEconomyFare(distanceKm.Value);
            }
            return 0m;
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
