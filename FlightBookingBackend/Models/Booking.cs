using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FlightBookingBackend.Models
{
    [Table("Bookings")]
    public class Booking
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int BookingId { get; set; }

        [Required]
        [MaxLength(50)]
        public string BookingReference { get; set; } = string.Empty;

        public Guid? IdempotencyKey { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public int FlightId { get; set; }

        [Required]
        [MaxLength(150)]
        public string PassengerName { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string PassengerEmail { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string PassengerPhone { get; set; } = string.Empty;

        public int PassengerAge { get; set; }

        [Required]
        [MaxLength(20)]
        public string PassengerGender { get; set; } = string.Empty;

        [Required]
        [MaxLength(10)]
        public string SeatNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Class { get; set; } = "Economy";

        public int PassengerCount { get; set; } = 1;

        public DateTime BookingDate { get; set; } = DateTime.UtcNow;

        [Column(TypeName = "date")]
        public DateOnly? FlightJourneyDate { get; set; }

        [Column(TypeName = "decimal(10,2)")]
        public decimal? DistanceKm { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? BaseFare { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Taxes { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TicketPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountAmount { get; set; }

        [Required]
        [MaxLength(50)]
        public string BookingStatus { get; set; } = BookingStatuses.Confirmed; // Confirmed | Pending | Cancelled | Rescheduled | Failed

        [Required]
        [MaxLength(50)]
        public string PaymentStatus { get; set; } = "Paid"; // "Paid", "Pending", "Failed"

        // Foreign keys and Navigation properties
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        [ForeignKey("FlightId")]
        public virtual Flight? Flight { get; set; }

        public virtual ICollection<CouponUsage> CouponUsages { get; set; } = new List<CouponUsage>();

        public virtual ICollection<CouponTransaction> CouponTransactions { get; set; } = new List<CouponTransaction>();

        public virtual Coupon? GeneratedCoupon { get; set; }
    }
}
