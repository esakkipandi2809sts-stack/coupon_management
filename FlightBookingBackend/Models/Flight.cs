using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FlightBookingBackend.Models
{
    [Table("Flights")]
    public class Flight
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int FlightId { get; set; }

        [Required]
        [MaxLength(50)]
        public string FlightNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Airline { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string FromCity { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string ToCity { get; set; } = string.Empty;

        [MaxLength(3)]
        [Column(TypeName = "varchar(3)")]
        public string? FromAirportCode { get; set; }

        [MaxLength(3)]
        [Column(TypeName = "varchar(3)")]
        public string? ToAirportCode { get; set; }

        public int? StopCount { get; set; }

        [Column(TypeName = "date")]
        public DateOnly DepartureDate { get; set; }

        [Required]
        [MaxLength(10)]
        public string DepartureTime { get; set; } = string.Empty;

        [Column(TypeName = "date")]
        public DateOnly ArrivalDate { get; set; }

        [Required]
        [MaxLength(10)]
        public string ArrivalTime { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Duration { get; set; } = string.Empty;

        [Column(TypeName = "decimal(10,2)")]
        public decimal? DistanceKm { get; set; }

        public int TotalSeats { get; set; }

        public int AvailableSeats { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Scheduled";

        // Username (login name) of the account that created the flight, taken from the JWT.
        // Null for flights created before creator tracking was introduced.
        [MaxLength(150)]
        public string? CreatedByUserName { get; set; }

        // Itinerary support: OneWay | RoundTrip | MultiCity. Legacy rows are OneWay.
        [Required]
        [MaxLength(20)]
        public string TripType { get; set; } = FlightTripTypes.OneWay;

        // Shared by every segment of a round-trip or multi-city itinerary; null for one-way flights.
        public Guid? ItineraryId { get; set; }

        // 1-based position of this flight inside its itinerary; null for one-way flights.
        public int? SegmentOrder { get; set; }

        // Navigation properties
        public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}

namespace FlightBookingBackend.Models
{
    public static class FlightTripTypes
    {
        public const string OneWay = "OneWay";
        public const string RoundTrip = "RoundTrip";
        public const string MultiCity = "MultiCity";

        public static bool IsSupported(string? tripType) =>
            tripType is OneWay or RoundTrip or MultiCity;
    }
}
