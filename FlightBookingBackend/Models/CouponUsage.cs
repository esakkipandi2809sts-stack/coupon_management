using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FlightBookingBackend.Models
{
    [Table("CouponUsage")]
    public class CouponUsage
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int CouponUsageId { get; set; }

        [Required]
        public int CouponId { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public int BookingId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountAmount { get; set; }

        public DateTime UsedAt { get; set; } = DateTime.UtcNow;

        // Foreign keys and Navigation properties
        [ForeignKey("CouponId")]
        public virtual Coupon? Coupon { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        [ForeignKey("BookingId")]
        public virtual Booking? Booking { get; set; }
    }
}
