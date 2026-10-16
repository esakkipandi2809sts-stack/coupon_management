using FlightBookingBackend.DTOs;

namespace FlightBookingBackend.Services
{
    public interface ICouponService
    {
        Task<IEnumerable<CouponDto>> GetAllCouponsAsync(int userId);
        Task<IEnumerable<CouponDto>> GetAllCouponsForAdminAsync();
        Task<CouponStatisticsDto> GetCouponStatisticsAsync(int userId);
        Task<CouponStatisticsDto> GetCouponStatisticsForAdminAsync();
        Task<CouponEligibilityDto> GetCouponEligibilityAsync(int userId);
        Task<CouponBalanceDto> GetCouponBalanceAsync(int userId);
        Task<CouponValidationResultDto> ValidateCouponAsync(string couponCode, int flightId, string flightClass, int userId, int passengerCount = 1);
        Task RefreshStatusesAsync();
        DateOnly GetBusinessDate();
    }
}
