using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FlightBookingBackend.Models
{
    [Table("Coupons")]
    public class Coupon
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int CouponId { get; set; }

        [Required]
        [StringLength(8, MinimumLength = 8)]
        [RegularExpression("^[A-Z0-9]{8}$")]
        [Column(TypeName = "varchar(8)")]
        public string CouponCode { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? LegacyCouponCode { get; set; }

        [Required]
        [MaxLength(255)]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string DiscountType { get; set; } = "Percentage"; // "Percentage" or "Fixed"

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountValue { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OriginalFlightFare { get; set; }

        [Column(TypeName = "decimal(5,2)")]
        public decimal DiscountPercentage { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountAmount { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal CouponPoints { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MinimumAmount { get; set; } = 0.00m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? MaximumDiscount { get; set; }

        public DateTime ExpiryDate { get; set; }

        public int TotalUsageLimit { get; set; } = 100;

        public int UsedCount { get; set; } = 0;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Available";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? UserId { get; set; }

        [MaxLength(150)]
        public string? Username { get; set; }

        [MaxLength(150)]
        public string? PassengerName { get; set; }

        public int? GeneratedForBookingId { get; set; }

        [Column(TypeName = "date")]
        public DateOnly? JourneyDate { get; set; }

        [Column(TypeName = "date")]
        public DateOnly? AvailableFromDate { get; set; }

        public virtual Booking? GeneratedForBooking { get; set; }

        // Navigation properties
        public virtual ICollection<CouponUsage> CouponUsages { get; set; } = new List<CouponUsage>();
    }
}
