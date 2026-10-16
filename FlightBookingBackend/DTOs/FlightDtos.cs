using System.ComponentModel.DataAnnotations;

namespace FlightBookingBackend.DTOs
{
    public class FlightDto
    {
        public int FlightId { get; set; }
        public string FlightNumber { get; set; } = string.Empty;
        public string Airline { get; set; } = string.Empty;
        public string FromCity { get; set; } = string.Empty;
        public string ToCity { get; set; } = string.Empty;
        public string? FromAirportCode { get; set; }
        public string? ToAirportCode { get; set; }
        public int? StopCount { get; set; }
        public DateOnly DepartureDate { get; set; }
        public string DepartureTime { get; set; } = string.Empty;
        public DateOnly ArrivalDate { get; set; }
        public string ArrivalTime { get; set; } = string.Empty;
        public string Duration { get; set; } = string.Empty;
        public decimal? DistanceKm { get; set; }
        public int TotalSeats { get; set; }
        public int AvailableSeats { get; set; }
        public decimal Price { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? CreatedByUserName { get; set; }
        public string TripType { get; set; } = "OneWay";
        public Guid? ItineraryId { get; set; }
        public int? SegmentOrder { get; set; }
    }

    public class FlightSearchQueryDto
    {
        public string? FromCity { get; set; }
        public string? ToCity { get; set; }
        public DateOnly? DepartureDate { get; set; }
        public DateOnly? ReturnDate { get; set; }
        public int Passengers { get; set; } = 1;
        [Range(1, 9)]
        public int Adults { get; set; } = 1;
        [Range(0, 9)]
        public int Children { get; set; }
        [Range(0, 9)]
        public int Infants { get; set; }
        public string? Airline { get; set; }
        public string? FlightNumber { get; set; }
        public bool DirectFlight { get; set; }
        public string? FlightClass { get; set; } = "Economy";
        public string? TripType { get; set; } = "One Way";
    }

    public class FlightSearchOptionsDto
    {
        public IReadOnlyList<string> Locations { get; set; } = Array.Empty<string>();
        public IReadOnlyList<string> Airlines { get; set; } = Array.Empty<string>();
    }

    public class CreateFlightDto
    {
        [Range(typeof(decimal), "0.01", "99999999.99")]
        public decimal DistanceKm { get; set; }

        [Required, StringLength(50, MinimumLength = 1)]
        public string FlightNumber { get; set; } = string.Empty;
        [Required, StringLength(100, MinimumLength = 1)]
        public string Airline { get; set; } = string.Empty;
        [Required, StringLength(100, MinimumLength = 1)]
        public string FromCity { get; set; } = string.Empty;
        [Required, StringLength(100, MinimumLength = 1)]
        public string ToCity { get; set; } = string.Empty;
        [StringLength(3, MinimumLength = 3), RegularExpression("^[A-Za-z]{3}$")]
        public string? FromAirportCode { get; set; }
        [StringLength(3, MinimumLength = 3), RegularExpression("^[A-Za-z]{3}$")]
        public string? ToAirportCode { get; set; }
        [Range(0, 99)]
        public int? StopCount { get; set; }
        public DateOnly DepartureDate { get; set; }
        [Required, StringLength(10, MinimumLength = 1)]
        public string DepartureTime { get; set; } = string.Empty;
        public DateOnly ArrivalDate { get; set; }
        [Required, StringLength(10, MinimumLength = 1)]
        public string ArrivalTime { get; set; } = string.Empty;
        [Required, StringLength(50, MinimumLength = 1)]
        public string Duration { get; set; } = string.Empty;
        [Range(1, int.MaxValue)]
        public int TotalSeats { get; set; }
        [Range(0, int.MaxValue)]
        public int AvailableSeats { get; set; }
        [Required, StringLength(50, MinimumLength = 1)]
        public string Status { get; set; } = "Scheduled";
    }

    /// <summary>
    /// Request body for POST /api/flights/itinerary.
    /// OneWay = 1 segment, RoundTrip = 2 segments (outbound, return), MultiCity = 2-6 segments in travel order.
    /// </summary>
    public class CreateItineraryDto
    {
        [Required]
        public string TripType { get; set; } = "OneWay";

        [Required, MinLength(1), MaxLength(6)]
        public List<CreateFlightDto> Segments { get; set; } = new();
    }

    public class ItineraryResultDto
    {
        public string TripType { get; set; } = "OneWay";
        public Guid? ItineraryId { get; set; }
        public decimal TotalFare { get; set; }
        public string Message { get; set; } = string.Empty;
        public IReadOnlyList<FlightDto> Flights { get; set; } = Array.Empty<FlightDto>();
    }
}
