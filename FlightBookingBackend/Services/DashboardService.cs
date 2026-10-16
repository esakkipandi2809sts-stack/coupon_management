using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Services
{
    public class DashboardService : IDashboardService
    {
        private readonly FlightBookingDbContext _context;
        private readonly ICouponService _couponService;

        public DashboardService(FlightBookingDbContext context, ICouponService couponService)
        {
            _context = context;
            _couponService = couponService;
        }

        public async Task<DashboardStatisticsDto> GetDashboardStatisticsAsync(int userId)
        {
            var couponStats = await _couponService.GetCouponStatisticsAsync(userId);

            var totalBookings = await _context.Bookings.CountAsync();
            var confirmedBookings = await _context.Bookings.CountAsync(b => b.BookingStatus == "Confirmed");
            var availableFlights = await _context.Flights.CountAsync(f => f.AvailableSeats > 0 && f.Status == "Scheduled");
            var totalUsers = await _context.Users.CountAsync(u => u.IsActive);
            var totalRevenue = await _context.Bookings
                .Where(b => b.PaymentStatus == "Paid")
                .SumAsync(b => (decimal?)b.TicketPrice) ?? 0m;

            return new DashboardStatisticsDto
            {
                AvailableCoupons = couponStats.AvailableCoupons,
                PendingCoupons = couponStats.PendingCoupons,
                UsedCoupons = couponStats.UsedCoupons,
                TotalCoupons = couponStats.TotalCoupons,
                TotalBookings = totalBookings,
                ConfirmedBookings = confirmedBookings,
                AvailableFlights = availableFlights,
                TotalUsers = totalUsers,
                TotalRevenue = totalRevenue
            };
        }

        public async Task<BookingStatisticsDto> GetBookingStatisticsAsync(int userId, bool isAdmin)
        {
            // Passengers only ever see their own bookings; administrators see the whole system.
            var bookings = _context.Bookings.AsNoTracking().AsQueryable();
            if (!isAdmin)
            {
                bookings = bookings.Where(b => b.UserId == userId);
            }

            // One grouped query over the Bookings table. BookingStatus holds a single value per row,
            // so a booking lands in exactly one bucket and can never be counted twice.
            var countsByStatus = await bookings
                .GroupBy(b => b.BookingStatus)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            int CountOf(string status) => countsByStatus
                .Where(c => string.Equals(c.Status, status, StringComparison.OrdinalIgnoreCase))
                .Sum(c => c.Count);

            return new BookingStatisticsDto
            {
                TotalBookings = countsByStatus.Sum(c => c.Count),
                CancelledBookings = CountOf(BookingStatuses.Cancelled),
                RescheduledBookings = CountOf(BookingStatuses.Rescheduled),
                FailedBookings = CountOf(BookingStatuses.Failed)
            };
        }

        public async Task<IEnumerable<RecentBookingDto>> GetRecentBookingsAsync(int count = 10)
        {
            var bookings = await _context.Bookings
                .Include(b => b.Flight)
                .OrderByDescending(b => b.BookingDate)
                .Take(count)
                .ToListAsync();

            return bookings.Select(b => new RecentBookingDto
            {
                BookingId = b.BookingId,
                BookingReference = b.BookingReference,
                PassengerName = b.PassengerName,
                FlightNumber = b.Flight?.FlightNumber ?? "N/A",
                Airline = b.Flight?.Airline ?? "N/A",
                Route = b.Flight != null ? $"{b.Flight.FromCity} → {b.Flight.ToCity}" : "N/A",
                BookingDate = b.BookingDate,
                Amount = b.TicketPrice,
                BookingStatus = b.BookingStatus,
                PaymentStatus = b.PaymentStatus,
                SeatNumber = b.SeatNumber,
                Class = b.Class
            });
        }
    }
}
