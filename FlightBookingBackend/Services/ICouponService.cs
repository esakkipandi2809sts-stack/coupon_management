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
        Task<(bool Success, string Message, CreateCouponFromPointsResultDto? Result)> CreateCouponFromPointsAsync(int userId, int points);
        Task<UserCouponCountDto> UpdateUserCouponCountsAsync(int userId);
        Task UpdateAllUserCouponCountsAsync();
        Task<UserCouponCountDto> GetUserCouponCountAsync(int userId);
        Task<IEnumerable<UserCouponCountDto>> GetAllUserCouponCountsAsync();
        Task RefreshStatusesAsync();
        DateOnly GetBusinessDate();
    }
}
