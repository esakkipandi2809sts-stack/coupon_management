using System.ComponentModel.DataAnnotations;

namespace FlightBookingBackend.DTOs
{
    public class CreateBookingDto
    {
        public Guid IdempotencyKey { get; set; }

        [Required]
        public int FlightId { get; set; }

        [Required(ErrorMessage = "Passenger name is required")]
        [StringLength(150, MinimumLength = 2)]
        public string PassengerName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Passenger email is required")]
        [EmailAddress]
        public string PassengerEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "Passenger phone is required")]
        public string PassengerPhone { get; set; } = string.Empty;

        [Range(1, 120, ErrorMessage = "Valid passenger age is required")]
        public int PassengerAge { get; set; }

        [Required(ErrorMessage = "Passenger gender is required")]
        public string PassengerGender { get; set; } = string.Empty;

        [Required(ErrorMessage = "Seat number is required")]
        public string SeatNumber { get; set; } = string.Empty;

        public string Class { get; set; } = "Economy";

        [Range(1, 27, ErrorMessage = "Passenger count must be between 1 and 27.")]
        public int PassengerCount { get; set; } = 1;

        public string? CouponCode { get; set; }

        public bool RedeemCouponPoints { get; set; }

        public string? PaymentMethod { get; set; } = "Credit Card";
    }

    public class RescheduleBookingDto
    {
        [Required]
        public int NewFlightId { get; set; }

        [Required(ErrorMessage = "Seat number is required")]
        public string SeatNumber { get; set; } = string.Empty;
    }

    public class BookingDetailDto
    {
        public int BookingId { get; set; }
        public string? Message { get; set; }
        public string BookingReference { get; set; } = string.Empty;
        public int UserId { get; set; }
        public int FlightId { get; set; }
        public string PassengerName { get; set; } = string.Empty;
        public string PassengerEmail { get; set; } = string.Empty;
        public string PassengerPhone { get; set; } = string.Empty;
        public int PassengerAge { get; set; }
        public string PassengerGender { get; set; } = string.Empty;
        public string SeatNumber { get; set; } = string.Empty;
        public string Class { get; set; } = string.Empty;
        public int PassengerCount { get; set; } = 1;
        public DateTime BookingDate { get; set; }
        public DateOnly? FlightJourneyDate { get; set; }
        public decimal? DistanceKm { get; set; }
        public decimal BaseFare { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal PointsRedeemed { get; set; }
        public decimal PointsDiscountAmount { get; set; }
        public decimal CouponPointsEarned { get; set; }
        public decimal AvailableCouponPoints { get; set; }
        public decimal Taxes { get; set; }
        public decimal FinalAmount { get; set; }
        public string BookingStatus { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public DateTime? CancelDate { get; set; }

        // Flight details
        public string FlightNumber { get; set; } = string.Empty;
        public string Airline { get; set; } = string.Empty;
        public string FromCity { get; set; } = string.Empty;
        public string ToCity { get; set; } = string.Empty;
        public DateOnly DepartureDate { get; set; }
        public string DepartureTime { get; set; } = string.Empty;
        public DateOnly ArrivalDate { get; set; }
        public string ArrivalTime { get; set; } = string.Empty;
        public string Duration { get; set; } = string.Empty;
        public string? AppliedCouponCode { get; set; }
        public string? GeneratedCouponCode { get; set; }
        public string? GeneratedCouponStatus { get; set; }
        public decimal? GeneratedCouponAmount { get; set; }
        public decimal? GeneratedCouponPoints { get; set; }
        public decimal? GeneratedCouponPercentage { get; set; }
        public decimal? AppliedCouponPercentage { get; set; }
        public decimal? AppliedCouponPoints { get; set; }
        public decimal? FinalFare { get; set; }
        public DateOnly? GeneratedCouponAvailableFromDate { get; set; }
    }
}
