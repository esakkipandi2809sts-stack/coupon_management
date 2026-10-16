using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;

namespace FlightBookingBackend.Services
{
    /// <summary>
    /// Business-rule validation for One Way, Round Trip and Multi-City flight creation.
    /// Field-level rules (required, lengths, ranges) are enforced by the DTO data annotations;
    /// this class enforces the rules that span fields or segments. It is pure (no database access)
    /// so the controller and the unit tests can call it directly.
    /// </summary>
    public static class FlightItineraryValidator
    {
        public const int MaxMultiCitySegments = 6;
        public const int MinMultiCitySegments = 2;

        /// <summary>
        /// Returns the first validation error, or null when the itinerary is valid.
        /// <paramref name="today"/> is the current date in the business time zone.
        /// </summary>
        public static string? Validate(CreateItineraryDto request, DateOnly today)
        {
            if (!FlightTripTypes.IsSupported(request.TripType))
                return "TripType must be OneWay, RoundTrip, or MultiCity.";

            var segments = request.Segments;
            if (segments == null || segments.Count == 0)
                return "At least one flight segment is required.";

            switch (request.TripType)
            {
                case FlightTripTypes.OneWay when segments.Count != 1:
                    return "A one-way flight must contain exactly one segment.";
                case FlightTripTypes.RoundTrip when segments.Count != 2:
                    return "A round trip must contain exactly two segments (outbound and return).";
                case FlightTripTypes.MultiCity when segments.Count < MinMultiCitySegments:
                    return $"A multi-city itinerary needs at least {MinMultiCitySegments} flight segments.";
                case FlightTripTypes.MultiCity when segments.Count > MaxMultiCitySegments:
                    return $"A multi-city itinerary can contain at most {MaxMultiCitySegments} flight segments.";
            }

            for (var i = 0; i < segments.Count; i++)
            {
                var error = ValidateSegment(segments[i], today);
                if (error != null)
                    return SegmentLabel(request.TripType, i) + ": " + error;
            }

            if (request.TripType == FlightTripTypes.RoundTrip)
            {
                var outbound = segments[0];
                var inbound = segments[1];
                if (!SameCity(inbound.FromCity, outbound.ToCity) || !SameCity(inbound.ToCity, outbound.FromCity))
                    return "Return flight: the return route must be the reverse of the outbound route.";
                if (inbound.DepartureDate < outbound.DepartureDate)
                    return "Return flight: the return date must be after the outbound departure date.";
                if (GetDeparture(inbound) < GetArrival(outbound))
                    return "Return flight: the return flight must depart after the outbound flight arrives.";
            }

            if (request.TripType == FlightTripTypes.MultiCity)
            {
                for (var i = 1; i < segments.Count; i++)
                {
                    if (GetDeparture(segments[i]) < GetArrival(segments[i - 1]))
                        return $"Flight {i + 1}: must depart after flight {i} arrives.";
                }
            }

            // The same flight number cannot appear twice with the same departure schedule.
            var duplicate = segments
                .GroupBy(s => (s.FlightNumber.Trim().ToUpperInvariant(), s.DepartureDate, s.DepartureTime.Trim()))
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicate != null)
                return $"Flight number {duplicate.First().FlightNumber.Trim()} is used twice with the same departure date and time.";

            return null;
        }

        public static string? ValidateSegment(CreateFlightDto dto, DateOnly today)
        {
            if (dto.DepartureDate == default || dto.ArrivalDate == default)
                return "Departure and arrival dates are required.";
            if (dto.DepartureDate < today)
                return "Departure date must be today or later.";
            if (string.Equals(dto.FromCity.Trim(), dto.ToCity.Trim(), StringComparison.OrdinalIgnoreCase))
                return "Origin and destination must be different.";
            if (!TryParseTime(dto.DepartureTime, out _) || !TryParseTime(dto.ArrivalTime, out _))
                return "Departure and arrival times must use the HH:mm format.";
            if (dto.ArrivalDate < dto.DepartureDate)
                return "Arrival date cannot be before the departure date.";
            if (GetArrival(dto) <= GetDeparture(dto))
                return "Arrival must be after departure.";
            if (dto.TotalSeats <= 0)
                return "Total seats must be greater than zero.";
            if (dto.AvailableSeats < 0)
                return "Available seats cannot be negative.";
            if (dto.AvailableSeats > dto.TotalSeats)
                return "Available seats cannot exceed total seats.";
            return null;
        }

        /// <summary>
        /// Route distance used for storage and fare: the project's RouteDistanceCalculator when both
        /// cities are supported, otherwise the distance supplied by the client. Null when neither exists.
        /// </summary>
        public static decimal? ResolveDistance(CreateFlightDto dto)
        {
            var calculated = RouteDistanceCalculator.TryCalculate(dto.FromCity, dto.ToCity);
            if (calculated.HasValue) return calculated;
            return dto.DistanceKm > 0m ? dto.DistanceKm : null;
        }

        public static string SegmentLabel(string tripType, int index) => tripType switch
        {
            FlightTripTypes.RoundTrip => index == 0 ? "Outbound flight" : "Return flight",
            FlightTripTypes.MultiCity => $"Flight {index + 1}",
            _ => "Flight"
        };

        private static bool SameCity(string a, string b) =>
            string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);

        private static bool TryParseTime(string value, out TimeOnly time) =>
            TimeOnly.TryParseExact(value.Trim(), new[] { "HH:mm", "H:mm", "HH:mm:ss" },
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out time);

        private static DateTime GetDeparture(CreateFlightDto dto) =>
            dto.DepartureDate.ToDateTime(ParseOrMidnight(dto.DepartureTime));

        private static DateTime GetArrival(CreateFlightDto dto) =>
            dto.ArrivalDate.ToDateTime(ParseOrMidnight(dto.ArrivalTime));

        private static TimeOnly ParseOrMidnight(string value) =>
            TryParseTime(value, out var time) ? time : TimeOnly.MinValue;
    }
}
