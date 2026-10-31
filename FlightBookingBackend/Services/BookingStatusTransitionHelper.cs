using FlightBookingBackend.Data;
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Services
{
    public static class BookingStatusTransitionHelper
    {
        /// <summary>
        /// When the travel date has passed, automatically change the booking status
        /// from Confirmed to Travelled.
        /// </summary>
        public static async Task<int> UpdatePassedBookingsToTravelledAsync(
            FlightBookingDbContext context,
            DateOnly today)
        {
            var passedBookings = await context.Bookings
                .Include(b => b.Flight)
                .Where(b => b.BookingStatus == BookingStatuses.Confirmed &&
                    ((b.FlightJourneyDate != null && b.FlightJourneyDate.Value < today) ||
                     (b.FlightJourneyDate == null && b.Flight != null && b.Flight.DepartureDate < today)))
                .ToListAsync();

            if (!passedBookings.Any())
            {
                return 0;
            }

            foreach (var booking in passedBookings)
            {
                booking.BookingStatus = BookingStatuses.Travelled;
            }

            return await context.SaveChangesAsync();
        }
    }
}
