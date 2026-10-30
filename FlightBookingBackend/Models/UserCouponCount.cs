using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FlightBookingBackend.Models
{
    [Table("UserCouponCounts")]
    public class UserCouponCount
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [MaxLength(150)]
        public string Username { get; set; } = string.Empty;

        public int AvailableCoupons { get; set; } = 0;

        public int PendingCoupons { get; set; } = 0;

        public int ExpiredCoupons { get; set; } = 0;

        public int UsedCoupons { get; set; } = 0;

        public int TotalCoupons { get; set; } = 0;

        public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}
