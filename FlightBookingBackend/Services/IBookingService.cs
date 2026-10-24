using FlightBookingBackend.DTOs;

namespace FlightBookingBackend.Services
{
    public interface IBookingService
    {
        Task<(bool Success, string Message, BookingDetailDto? Booking)> CreateBookingAsync(int userId, CreateBookingDto dto);
        Task<IEnumerable<BookingDetailDto>> GetUserBookingsAsync(int userId);
        Task<BookingDetailDto?> GetBookingByIdAsync(int bookingId, int userId);
        Task<(bool Success, string Message)> CancelBookingAsync(int bookingId, int userId, bool isAdmin = false);
        Task<(bool Success, string Message, BookingDetailDto? Booking)> RescheduleBookingAsync(int bookingId, int userId, RescheduleBookingDto dto);
    }
}
