using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlightBookingBackend.Tests;

public class BookingStatisticsTests
{
    [Fact]
    public async Task CountsAreCalculatedFromBookingRecordsAndNeverDoubleCount()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var otherUser = CreateUser();
        var flight = CreateFlight("TEST-100", DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));
        context.AddRange(user, otherUser, flight);
        await context.SaveChangesAsync();

        context.Bookings.AddRange(
            CreateBooking(user.Id, flight.FlightId, "1A", BookingStatuses.Confirmed),
            CreateBooking(user.Id, flight.FlightId, "1B", BookingStatuses.Cancelled),
            CreateBooking(user.Id, flight.FlightId, "1C", BookingStatuses.Cancelled),
            CreateBooking(user.Id, flight.FlightId, "1D", BookingStatuses.Rescheduled),
            CreateBooking(user.Id, flight.FlightId, "1E", BookingStatuses.Failed),
            CreateBooking(otherUser.Id, flight.FlightId, "2A", BookingStatuses.Cancelled),
            CreateBooking(otherUser.Id, flight.FlightId, "2B", BookingStatuses.Failed));
        await context.SaveChangesAsync();

        var service = new DashboardService(context, new CouponService(context));

        var mine = await service.GetBookingStatisticsAsync(user.Id, isAdmin: false);
        Assert.Equal(5, mine.TotalBookings);
        Assert.Equal(2, mine.CancelledBookings);
        Assert.Equal(1, mine.RescheduledBookings);
        Assert.Equal(1, mine.FailedBookings);

        var theirs = await service.GetBookingStatisticsAsync(otherUser.Id, isAdmin: false);
        Assert.Equal(2, theirs.TotalBookings);
        Assert.Equal(1, theirs.CancelledBookings);
        Assert.Equal(0, theirs.RescheduledBookings);
        Assert.Equal(1, theirs.FailedBookings);

        var admin = await service.GetBookingStatisticsAsync(user.Id, isAdmin: true);
        Assert.Equal(7, admin.TotalBookings);
        Assert.Equal(3, admin.CancelledBookings);
        Assert.Equal(1, admin.RescheduledBookings);
        Assert.Equal(2, admin.FailedBookings);
    }

    [Fact]
    public async Task UserWithNoBookingsGetsZeroCounts()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var stats = await new DashboardService(context, new CouponService(context))
            .GetBookingStatisticsAsync(user.Id, isAdmin: false);

        Assert.Equal(0, stats.TotalBookings);
        Assert.Equal(0, stats.CancelledBookings);
        Assert.Equal(0, stats.RescheduledBookings);
        Assert.Equal(0, stats.FailedBookings);
    }

    [Fact]
    public async Task CancellingABookingMovesItFromConfirmedToCancelledOnly()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight("TEST-100", DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var bookingService = new BookingService(context, new CouponService(context));
        var created = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight.FlightId, "3A"));
        Assert.True(created.Success, created.Message);

        var dashboard = new DashboardService(context, new CouponService(context));
        var before = await dashboard.GetBookingStatisticsAsync(user.Id, false);
        Assert.Equal(1, before.TotalBookings);
        Assert.Equal(0, before.CancelledBookings);

        var cancelled = await bookingService.CancelBookingAsync(created.Booking!.BookingId, user.Id);
        Assert.True(cancelled.Success, cancelled.Message);

        var after = await dashboard.GetBookingStatisticsAsync(user.Id, false);
        Assert.Equal(1, after.TotalBookings);
        Assert.Equal(1, after.CancelledBookings);
        Assert.Equal(0, after.RescheduledBookings);
    }

    [Fact]
    public async Task ReschedulingMovesTheSeatAndMarksTheBookingRescheduled()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var oldFlight = CreateFlight("TEST-100", today.AddDays(5));
        var newFlight = CreateFlight("TEST-200", today.AddDays(9));
        context.AddRange(user, oldFlight, newFlight);
        await context.SaveChangesAsync();

        var bookingService = new BookingService(context, new CouponService(context));
        var created = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(oldFlight.FlightId, "4A"));
        Assert.True(created.Success, created.Message);

        var result = await bookingService.RescheduleBookingAsync(
            created.Booking!.BookingId,
            user.Id,
            new RescheduleBookingDto { NewFlightId = newFlight.FlightId, SeatNumber = "5c" });

        Assert.True(result.Success, result.Message);

        var booking = await context.Bookings.AsNoTracking().SingleAsync();
        Assert.Equal(BookingStatuses.Rescheduled, booking.BookingStatus);
        Assert.Equal(newFlight.FlightId, booking.FlightId);
        Assert.Equal("5C", booking.SeatNumber);
        Assert.Equal(newFlight.DepartureDate, booking.FlightJourneyDate);
        Assert.Equal(created.Booking.FinalAmount, booking.TicketPrice);

        var flights = await context.Flights.AsNoTracking().ToDictionaryAsync(f => f.FlightId);
        Assert.Equal(10, flights[oldFlight.FlightId].AvailableSeats);
        Assert.Equal(9, flights[newFlight.FlightId].AvailableSeats);

        var coupon = await context.Coupons.AsNoTracking().SingleAsync();
        Assert.Equal(newFlight.DepartureDate, coupon.AvailableFromDate);

        var stats = await new DashboardService(context, new CouponService(context))
            .GetBookingStatisticsAsync(user.Id, false);
        Assert.Equal(1, stats.TotalBookings);
        Assert.Equal(1, stats.RescheduledBookings);
        Assert.Equal(0, stats.CancelledBookings);

        // A rescheduled booking can still be cancelled and then counts only as Cancelled.
        var cancelled = await bookingService.CancelBookingAsync(booking.BookingId, user.Id);
        Assert.True(cancelled.Success, cancelled.Message);
        var afterCancel = await new DashboardService(context, new CouponService(context))
            .GetBookingStatisticsAsync(user.Id, false);
        Assert.Equal(1, afterCancel.TotalBookings);
        Assert.Equal(1, afterCancel.CancelledBookings);
        Assert.Equal(0, afterCancel.RescheduledBookings);
        var seatsAfterCancel = (await context.Flights.AsNoTracking().SingleAsync(f => f.FlightId == newFlight.FlightId)).AvailableSeats;
        Assert.Equal(10, seatsAfterCancel);
    }

    [Fact]
    public async Task ReschedulingSupportsOtherRoutesAndRejectsTakenSeatsAndInactiveBookings()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var other = CreateUser();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var oldFlight = CreateFlight("TEST-100", today.AddDays(5));
        var sameRoute = CreateFlight("TEST-200", today.AddDays(9));
        var otherRoute = CreateFlight("TEST-300", today.AddDays(9));
        otherRoute.FromCity = "Delhi";
        otherRoute.ToCity = "Mumbai";
        context.AddRange(user, other, oldFlight, sameRoute, otherRoute);
        await context.SaveChangesAsync();

        var bookingService = new BookingService(context, new CouponService(context));
        var mine = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(oldFlight.FlightId, "6A"));
        var theirs = await bookingService.CreateBookingAsync(other.Id, CreateBookingRequest(sameRoute.FlightId, "7A"));
        Assert.True(mine.Success, mine.Message);
        Assert.True(theirs.Success, theirs.Message);
        var bookingId = mine.Booking!.BookingId;

        // Rescheduling to same flight is rejected
        var sameFlight = await bookingService.RescheduleBookingAsync(
            bookingId, user.Id, new RescheduleBookingDto { NewFlightId = oldFlight.FlightId, SeatNumber = "8A" });
        Assert.False(sameFlight.Success);

        // Rescheduling to taken seat is rejected
        var seatTaken = await bookingService.RescheduleBookingAsync(
            bookingId, user.Id, new RescheduleBookingDto { NewFlightId = sameRoute.FlightId, SeatNumber = "7A" });
        Assert.False(seatTaken.Success);

        // Rescheduling by non-owner is rejected
        var notOwner = await bookingService.RescheduleBookingAsync(
            bookingId, other.Id, new RescheduleBookingDto { NewFlightId = sameRoute.FlightId, SeatNumber = "8A" });
        Assert.False(notOwner.Success);

        // Rescheduling to a different route succeeds
        var newRouteReschedule = await bookingService.RescheduleBookingAsync(
            bookingId, user.Id, new RescheduleBookingDto { NewFlightId = otherRoute.FlightId, SeatNumber = "8A" });
        Assert.True(newRouteReschedule.Success, newRouteReschedule.Message);
        var updatedBooking = await context.Bookings.AsNoTracking().SingleAsync(b => b.BookingId == bookingId);
        Assert.Equal(BookingStatuses.Rescheduled, updatedBooking.BookingStatus);
        Assert.Equal(otherRoute.FlightId, updatedBooking.FlightId);

        // Cancelled booking cannot be rescheduled
        await bookingService.CancelBookingAsync(bookingId, user.Id);
        var cancelledBooking = await bookingService.RescheduleBookingAsync(
            bookingId, user.Id, new RescheduleBookingDto { NewFlightId = sameRoute.FlightId, SeatNumber = "9A" });
        Assert.False(cancelledBooking.Success);
    }

    [Fact]
    public async Task FailedBookingsDoNotHoldSeatsAndCannotBeCancelled()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight("TEST-100", DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var failed = CreateBooking(user.Id, flight.FlightId, "9A", BookingStatuses.Failed);
        failed.PaymentStatus = "Failed";
        context.Bookings.Add(failed);
        await context.SaveChangesAsync();

        var bookingService = new BookingService(context, new CouponService(context));

        // The seat of a failed attempt is still free.
        var retry = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight.FlightId, "9A"));
        Assert.True(retry.Success, retry.Message);

        // A failed booking never held a seat, so it cannot be cancelled (which would release one).
        var cancel = await bookingService.CancelBookingAsync(failed.BookingId, user.Id);
        Assert.False(cancel.Success);
        Assert.Equal(9, (await context.Flights.AsNoTracking().SingleAsync()).AvailableSeats);

        var stats = await new DashboardService(context, new CouponService(context))
            .GetBookingStatisticsAsync(user.Id, false);
        Assert.Equal(2, stats.TotalBookings);
        Assert.Equal(1, stats.FailedBookings);
    }

    private static async Task<SqliteConnection> OpenDatabaseAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        return connection;
    }

    private static FlightBookingDbContext CreateContext(SqliteConnection connection)
    {
        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        return new FlightBookingDbContext(options);
    }

    private static User CreateUser() => new()
    {
        FullName = "Test Passenger",
        Username = $"passenger-{Guid.NewGuid():N}@example.test",
        Email = $"passenger-{Guid.NewGuid():N}@example.test",
        PhoneNumber = "555-0100",
        PasswordHash = "test-hash",
        CreatedAt = DateTime.UtcNow,
        IsActive = true
    };

    private static Flight CreateFlight(string flightNumber, DateOnly departureDate) => new()
    {
        FlightNumber = flightNumber,
        Airline = "Test Airways",
        FromCity = "Chennai",
        ToCity = "Bangalore",
        DepartureDate = departureDate,
        DepartureTime = "10:00",
        ArrivalDate = departureDate,
        ArrivalTime = "11:00",
        Duration = "1h",
        DistanceKm = 100m,
        TotalSeats = 10,
        AvailableSeats = 10,
        Price = 1500m,
        Status = "Scheduled"
    };

    private static CreateBookingDto CreateBookingRequest(int flightId, string seat) => new()
    {
        IdempotencyKey = Guid.NewGuid(),
        FlightId = flightId,
        PassengerName = "Test Passenger",
        PassengerEmail = "passenger@example.test",
        PassengerPhone = "555-0100",
        PassengerAge = 30,
        PassengerGender = "Other",
        SeatNumber = seat,
        Class = "Economy"
    };

    private static Booking CreateBooking(int userId, int flightId, string seat, string status) => new()
    {
        BookingReference = $"TEST-{Guid.NewGuid():N}",
        UserId = userId,
        FlightId = flightId,
        PassengerName = "Test Passenger",
        PassengerEmail = "passenger@example.test",
        PassengerPhone = "555-0100",
        PassengerAge = 30,
        PassengerGender = "Other",
        SeatNumber = seat,
        Class = "Economy",
        BookingDate = DateTime.UtcNow.AddDays(-1),
        FlightJourneyDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5),
        DistanceKm = 100m,
        BaseFare = 1500m,
        Taxes = 0m,
        TicketPrice = 1500m,
        BookingStatus = status,
        PaymentStatus = status == BookingStatuses.Failed ? "Failed" : "Paid"
    };
}
