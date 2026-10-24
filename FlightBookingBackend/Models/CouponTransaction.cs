using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FlightBookingBackend.Models
{
    [Table("CouponTransactions")]
    public class CouponTransaction
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int CouponTransactionId { get; set; }

        [Required]
        public int UserId { get; set; }

        public int? BookingId { get; set; }

        [Required]
        [MaxLength(20)]
        public string TransactionType { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,4)")]
        public decimal Points { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DiscountAmount { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = string.Empty;

        public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

        [ForeignKey("BookingId")]
        public virtual Booking? Booking { get; set; }
    }
}
