namespace FlightBookingBackend.Services
{
    /// <summary>
    /// Calculates the approximate route distance between two supported Indian cities
    /// using great-circle distance. Distances >= 100 km are rounded to the nearest 10 km
    /// (e.g. Chennai to Delhi ~ 1,760 km).
    /// </summary>
    public static class RouteDistanceCalculator
    {
        private const double EarthRadiusKm = 6371d;

        private static readonly Dictionary<string, (double Latitude, double Longitude)> CityCoordinates = new()
        {
            ["ahmedabad"] = (23.0225, 72.5714),
            ["amritsar"] = (31.634, 74.8723),
            ["bengaluru"] = (12.9716, 77.5946),
            ["bhopal"] = (23.2599, 77.4126),
            ["bhubaneswar"] = (20.2961, 85.8245),
            ["chandigarh"] = (30.7333, 76.7794),
            ["chennai"] = (13.0827, 80.2707),
            ["coimbatore"] = (11.0168, 76.9558),
            ["dehradun"] = (30.3165, 78.0322),
            ["delhi"] = (28.6139, 77.209),
            ["goa"] = (15.2993, 74.124),
            ["guwahati"] = (26.1445, 91.7362),
            ["hyderabad"] = (17.385, 78.4867),
            ["indore"] = (22.7196, 75.8577),
            ["jaipur"] = (26.9124, 75.7873),
            ["jammu"] = (32.7266, 74.857),
            ["kochi"] = (9.9312, 76.2673),
            ["kolkata"] = (22.5726, 88.3639),
            ["lucknow"] = (26.8467, 80.9462),
            ["ludhiana"] = (30.901, 75.8573),
            ["madurai"] = (9.9252, 78.1198),
            ["mangalore"] = (12.9141, 74.856),
            ["mumbai"] = (19.076, 72.8777),
            ["mysuru"] = (12.2958, 76.6394),
            ["nagpur"] = (21.1458, 79.0882),
            ["patna"] = (25.5941, 85.1376),
            ["pondicherry"] = (11.9416, 79.8083),
            ["prayagraj"] = (25.4358, 81.8463),
            ["pune"] = (18.5204, 73.8567),
            ["raipur"] = (21.2514, 81.6296),
            ["ranchi"] = (23.3441, 85.3096),
            ["surat"] = (21.1702, 72.8311),
            ["thiruvananthapuram"] = (8.5241, 76.9366),
            ["tiruchirappalli"] = (10.7905, 78.7047),
            ["udaipur"] = (24.5854, 73.7125),
            ["vadodara"] = (22.3072, 73.1812),
            ["varanasi"] = (25.3176, 82.9739),
            ["vijayawada"] = (16.5062, 80.648),
            ["visakhapatnam"] = (17.6868, 83.2185),
            ["dubai"] = (25.2048, 55.2708),
            ["london"] = (51.5074, -0.1278),
            ["paris"] = (48.8566, 2.3522),
            ["new york"] = (40.7128, -74.0060),
            ["los angeles"] = (34.0522, -118.2437),
            ["singapore"] = (1.3521, 103.8198),
            ["sydney"] = (-33.8688, 151.2093),
            ["tokyo"] = (35.6762, 139.6503),
            ["san francisco"] = (37.7749, -122.4194)
        };

        private static readonly Dictionary<string, string> CityAliases = new()
        {
            ["bangalore"] = "bengaluru",
            ["calicut"] = "kochi",
            ["kozhikode"] = "kochi",
            ["trivandrum"] = "thiruvananthapuram",
            ["trichy"] = "tiruchirappalli",
            ["vizag"] = "visakhapatnam",
            ["dxb"] = "dubai",
            ["lhr"] = "london",
            ["cdg"] = "paris",
            ["jfk"] = "new york",
            ["lax"] = "los angeles",
            ["sin"] = "singapore",
            ["syd"] = "sydney",
            ["nrt"] = "tokyo",
            ["sfo"] = "san francisco",
            ["bom"] = "mumbai",
            ["del"] = "delhi",
            ["maa"] = "chennai",
            ["blr"] = "bengaluru"
        };

        /// <summary>
        /// Returns the route distance in km, or null when either city is not in the supported list.
        /// </summary>
        public static decimal? TryCalculate(string? fromCity, string? toCity)
        {
            if (!TryGetCoordinates(fromCity, out var from) || !TryGetCoordinates(toCity, out var to))
            {
                return null;
            }

            var fromLatitude = ToRadians(from.Latitude);
            var toLatitude = ToRadians(to.Latitude);
            var latitudeDelta = toLatitude - fromLatitude;
            var longitudeDelta = ToRadians(to.Longitude) - ToRadians(from.Longitude);

            var haversine =
                Math.Pow(Math.Sin(latitudeDelta / 2d), 2d) +
                Math.Cos(fromLatitude) * Math.Cos(toLatitude) * Math.Pow(Math.Sin(longitudeDelta / 2d), 2d);

            var greatCircleKm = EarthRadiusKm * 2d * Math.Atan2(Math.Sqrt(haversine), Math.Sqrt(1d - haversine));
            if (greatCircleKm <= 0d)
            {
                return null;
            }

            var approxKm = greatCircleKm >= 100d
                ? Math.Round(greatCircleKm / 10d, MidpointRounding.AwayFromZero) * 10d
                : Math.Round(greatCircleKm, MidpointRounding.AwayFromZero);
            var distance = (decimal)approxKm;

            return distance > 0m ? distance : null;
        }

        private static bool TryGetCoordinates(string? city, out (double Latitude, double Longitude) coordinates)
        {
            coordinates = default;
            if (string.IsNullOrWhiteSpace(city))
            {
                return false;
            }

            var cleaned = System.Text.RegularExpressions.Regex.Replace(city.Trim(), @"\s*\(.*?\)", "");
            var normalized = string.Join(' ', (string.IsNullOrWhiteSpace(cleaned) ? city : cleaned).Trim().ToLowerInvariant()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries));
            if (CityAliases.TryGetValue(normalized, out var canonical))
            {
                normalized = canonical;
            }

            return CityCoordinates.TryGetValue(normalized, out coordinates);
        }

        private static double ToRadians(double degrees) => degrees * Math.PI / 180d;
    }
}
