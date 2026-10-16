using FlightBookingBackend.DTOs;

namespace FlightBookingBackend.Services
{
    public interface IDashboardService
    {
        Task<DashboardStatisticsDto> GetDashboardStatisticsAsync(int userId);
        Task<IEnumerable<RecentBookingDto>> GetRecentBookingsAsync(int count = 10);
        Task<BookingStatisticsDto> GetBookingStatisticsAsync(int userId, bool isAdmin);
    }
}
