using System.ComponentModel.DataAnnotations;

namespace FlightBookingBackend.DTOs
{
    public class CouponDto
    {
        public int CouponId { get; set; }
        public int? UserId { get; set; }
        public string? Username { get; set; }
        public string? OwnerUsername { get; set; }
        public string? PassengerName { get; set; }
        public string CouponCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public decimal OriginalFlightFare { get; set; }
        public decimal DiscountPercentage { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal CouponPoints { get; set; }
        public decimal MinimumAmount { get; set; }
        public decimal? MaximumDiscount { get; set; }
        public DateTime ExpiryDate { get; set; }
        public int TotalUsageLimit { get; set; }
        public int UsedCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? BookingReference { get; set; }
        public DateTime? BookingDate { get; set; }
        public string? BookingStatus { get; set; }
        public DateOnly? JourneyDate { get; set; }
        public DateOnly? AvailableFromDate { get; set; }
    }

    public class ValidateCouponRequestDto
    {
        [Required]
        public string CouponCode { get; set; } = string.Empty;

        [Range(1, int.MaxValue, ErrorMessage = "Flight ID must be greater than 0")]
        public int FlightId { get; set; }

        public string Class { get; set; } = "Economy";

        [Range(1, 27, ErrorMessage = "Passenger count must be between 1 and 27.")]
        public int PassengerCount { get; set; } = 1;
    }

    public class CouponValidationResultDto
    {
        public bool IsValid { get; set; }
        public string CouponCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal CouponPoints { get; set; }
        public decimal DiscountPercentage { get; set; }
        public decimal FinalPrice { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class CouponStatisticsDto
    {
        public int AvailableCoupons { get; set; }
        public int PendingCoupons { get; set; }
        public int UsedCoupons { get; set; }
        public int ExpiredCoupons { get; set; }
        public int TotalCoupons { get; set; }
    }

    public class UserCouponCountDto
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public int AvailableCoupons { get; set; }
        public int PendingCoupons { get; set; }
        public int ExpiredCoupons { get; set; }
        public int UsedCoupons { get; set; }
        public int TotalCoupons { get; set; }
        public DateTime LastUpdatedAt { get; set; }
    }

    public class CouponEligibilityDto
    {
        public int SuccessfulBookingCount { get; set; }
        public bool IsEligible { get; set; }
    }

    public class CouponBalanceDto
    {
        public decimal AvailablePoints { get; set; }
        public decimal PendingPoints { get; set; }
        public decimal RedeemedPoints { get; set; }
        public decimal TotalPoints { get; set; }
        public decimal AvailableDiscountAmount { get; set; }
    }

    public class CreateCouponFromPointsDto
    {
        [Range(10, int.MaxValue, ErrorMessage = "Minimum 10 points are required to create a coupon.")]
        public int Points { get; set; }
    }

    public class CreateCouponFromPointsResultDto
    {
        public string CouponCode { get; set; } = string.Empty;
        public decimal DiscountAmount { get; set; }
        public int PointsRedeemed { get; set; }
        public DateTime ExpiryDate { get; set; }
        public string Status { get; set; } = "Pending";
    }
}
