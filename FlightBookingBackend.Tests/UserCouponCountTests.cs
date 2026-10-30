using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlightBookingBackend.Tests;

public class UserCouponCountTests
{
    [Fact]
    public async Task UserCouponCountsAreMaintainedSeparatelyForEachUserInDatabase()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var userA = CreateUser(1, "alice", "alice@example.com");
        var userB = CreateUser(2, "bob", "bob@example.com");
        context.Users.AddRange(userA, userB);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);

        // User A gets 1 Available and 1 Pending coupon
        context.Coupons.AddRange(
            new Coupon
            {
                CouponCode = "ALICEAV1",
                Description = "Alice Available",
                DiscountType = "Fixed",
                DiscountValue = 50m,
                DiscountAmount = 50m,
                ExpiryDate = DateTime.UtcNow.AddMonths(6),
                Status = "Available",
                UserId = userA.Id,
                Username = userA.Username
            },
            new Coupon
            {
                CouponCode = "ALICEPD1",
                Description = "Alice Pending",
                DiscountType = "Fixed",
                DiscountValue = 30m,
                DiscountAmount = 30m,
                ExpiryDate = DateTime.UtcNow.AddMonths(6),
                Status = "Pending",
                UserId = userA.Id,
                Username = userA.Username
            }
        );

        // User B gets 1 Used and 1 Expired coupon
        context.Coupons.AddRange(
            new Coupon
            {
                CouponCode = "BOBUSED1",
                Description = "Bob Used",
                DiscountType = "Fixed",
                DiscountValue = 20m,
                DiscountAmount = 20m,
                UsedCount = 1,
                ExpiryDate = DateTime.UtcNow.AddMonths(6),
                Status = "Used",
                UserId = userB.Id,
                Username = userB.Username
            },
            new Coupon
            {
                CouponCode = "BOBEXP11",
                Description = "Bob Expired",
                DiscountType = "Fixed",
                DiscountValue = 10m,
                DiscountAmount = 10m,
                ExpiryDate = DateTime.UtcNow.AddDays(-1),
                Status = "Expired",
                UserId = userB.Id,
                Username = userB.Username
            }
        );

        await context.SaveChangesAsync();

        // Update counts for both users
        await couponService.UpdateUserCouponCountsAsync(userA.Id);
        await couponService.UpdateUserCouponCountsAsync(userB.Id);

        // Verify UserCouponCounts table for User A
        var countRecordA = await context.UserCouponCounts.SingleAsync(c => c.UserId == userA.Id);
        Assert.Equal("alice", countRecordA.Username);
        Assert.Equal(1, countRecordA.AvailableCoupons);
        Assert.Equal(1, countRecordA.PendingCoupons);
        Assert.Equal(0, countRecordA.UsedCoupons);
        Assert.Equal(0, countRecordA.ExpiredCoupons);
        Assert.Equal(2, countRecordA.TotalCoupons);

        // Verify Users table columns for User A
        var updatedUserA = await context.Users.SingleAsync(u => u.Id == userA.Id);
        Assert.Equal(1, updatedUserA.AvailableCoupons);
        Assert.Equal(1, updatedUserA.PendingCoupons);
        Assert.Equal(0, updatedUserA.UsedCoupons);
        Assert.Equal(0, updatedUserA.ExpiredCoupons);
        Assert.Equal(2, updatedUserA.TotalCoupons);

        // Verify UserCouponCounts table for User B
        var countRecordB = await context.UserCouponCounts.SingleAsync(c => c.UserId == userB.Id);
        Assert.Equal("bob", countRecordB.Username);
        Assert.Equal(0, countRecordB.AvailableCoupons);
        Assert.Equal(0, countRecordB.PendingCoupons);
        Assert.Equal(1, countRecordB.UsedCoupons);
        Assert.Equal(1, countRecordB.ExpiredCoupons);
        Assert.Equal(2, countRecordB.TotalCoupons);

        // Verify Users table columns for User B
        var updatedUserB = await context.Users.SingleAsync(u => u.Id == userB.Id);
        Assert.Equal(0, updatedUserB.AvailableCoupons);
        Assert.Equal(0, updatedUserB.PendingCoupons);
        Assert.Equal(1, updatedUserB.UsedCoupons);
        Assert.Equal(1, updatedUserB.ExpiredCoupons);
        Assert.Equal(2, updatedUserB.TotalCoupons);

        // Verify controller/service retrieval
        var userCountA = await couponService.GetUserCouponCountAsync(userA.Id);
        Assert.Equal("alice", userCountA.Username);
        Assert.Equal(1, userCountA.AvailableCoupons);
        Assert.Equal(1, userCountA.PendingCoupons);
        Assert.Equal(2, userCountA.TotalCoupons);
    }

    [Fact]
    public async Task BookingCreationStoresUsernameOnCouponAndUpdatesCountsAutomatically()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser(1, "charlie", "charlie@example.com");
        var flight = CreateFlight(1, 200m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));
        context.Users.Add(user);
        context.Flights.Add(flight);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var bookingService = new BookingService(context, couponService);

        var bookingRequest = new CreateBookingDto
        {
            IdempotencyKey = Guid.NewGuid(),
            FlightId = flight.FlightId,
            PassengerName = "Charlie Brown",
            PassengerEmail = "charlie@example.com",
            PassengerPhone = "+1 555-1234",
            PassengerAge = 30,
            PassengerGender = "Male",
            Class = "Economy",
            SeatNumber = "12A",
            PassengerCount = 1
        };

        var result = await bookingService.CreateBookingAsync(user.Id, bookingRequest);
        Assert.True(result.Success, result.Message);

        // Verify the coupon stored in database has Username
        var coupon = await context.Coupons.SingleAsync(c => c.UserId == user.Id);
        Assert.Equal("charlie", coupon.Username);
        Assert.Equal(user.Id, coupon.UserId);
        Assert.Equal("Pending", coupon.Status);

        // Verify UserCouponCounts table was automatically created/updated
        var countRecord = await context.UserCouponCounts.SingleAsync(c => c.UserId == user.Id);
        Assert.Equal("charlie", countRecord.Username);
        Assert.Equal(0, countRecord.AvailableCoupons);
        Assert.Equal(1, countRecord.PendingCoupons);
        Assert.Equal(0, countRecord.UsedCoupons);
        Assert.Equal(0, countRecord.ExpiredCoupons);
        Assert.Equal(1, countRecord.TotalCoupons);

        // Verify Users table columns
        var updatedUser = await context.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(1, updatedUser.PendingCoupons);
        Assert.Equal(1, updatedUser.TotalCoupons);
    }

    [Fact]
    public async Task RefreshStatusesAutomaticallyUpdatesUserCouponCountsWhenCouponsBecomeAvailableOrExpire()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser(1, "diana", "diana@example.com");
        var pastFlight = CreateFlight(1, 200m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1));
        var booking = new Booking
        {
            BookingId = 1,
            BookingReference = "FLT-TEST-100",
            UserId = user.Id,
            FlightId = pastFlight.FlightId,
            Flight = pastFlight,
            PassengerName = "Diana Prince",
            PassengerEmail = "diana@example.com",
            PassengerPhone = "+1 555-9999",
            SeatNumber = "1A",
            Class = "Economy",
            BookingStatus = "Confirmed",
            PaymentStatus = "Paid",
            BookingDate = DateTime.UtcNow.AddDays(-2),
            FlightJourneyDate = pastFlight.DepartureDate
        };

        // Coupon generated for past flight (pending, but departure date is in the past)
        var pendingCoupon = new Coupon
        {
            CouponCode = "DIANAPD1",
            Description = "Diana Reward",
            DiscountType = "Fixed",
            DiscountValue = 50m,
            DiscountAmount = 50m,
            ExpiryDate = DateTime.UtcNow.AddMonths(6),
            Status = "Pending",
            UserId = user.Id,
            Username = user.Username,
            GeneratedForBookingId = booking.BookingId,
            GeneratedForBooking = booking
        };

        // An expired coupon
        var expiredCoupon = new Coupon
        {
            CouponCode = "DIANAEX1",
            Description = "Diana Expired",
            DiscountType = "Fixed",
            DiscountValue = 20m,
            DiscountAmount = 20m,
            ExpiryDate = DateTime.UtcNow.AddDays(-1),
            Status = "Available",
            UserId = user.Id,
            Username = user.Username
        };

        context.Users.Add(user);
        context.Flights.Add(pastFlight);
        context.Bookings.Add(booking);
        context.Coupons.AddRange(pendingCoupon, expiredCoupon);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var couponService = new CouponService(context);

        // Trigger status refresh
        await couponService.RefreshStatusesAsync();

        // Verify coupon states
        var refreshedPending = await context.Coupons.SingleAsync(c => c.CouponCode == "DIANAPD1");
        Assert.Equal("Available", refreshedPending.Status);

        var refreshedExpired = await context.Coupons.SingleAsync(c => c.CouponCode == "DIANAEX1");
        Assert.Equal("Expired", refreshedExpired.Status);

        // Verify UserCouponCounts table automatically updated
        var countRecord = await context.UserCouponCounts.SingleAsync(c => c.UserId == user.Id);
        Assert.Equal("diana", countRecord.Username);
        Assert.Equal(1, countRecord.AvailableCoupons);
        Assert.Equal(0, countRecord.PendingCoupons);
        Assert.Equal(0, countRecord.UsedCoupons);
        Assert.Equal(1, countRecord.ExpiredCoupons);
        Assert.Equal(2, countRecord.TotalCoupons);

        // Verify Users table columns automatically updated
        var updatedUser = await context.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(1, updatedUser.AvailableCoupons);
        Assert.Equal(0, updatedUser.PendingCoupons);
        Assert.Equal(1, updatedUser.ExpiredCoupons);
        Assert.Equal(2, updatedUser.TotalCoupons);
    }

    [Fact]
    public async Task UsingCouponAndCancellingBookingUpdatesCountsAutomatically()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser(1, "evan", "evan@example.com");
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var flight1 = CreateFlight(1, 200m, today);
        var flight2 = CreateFlight(2, 200m, today.AddDays(5));
        context.Users.Add(user);
        context.Flights.AddRange(flight1, flight2);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var bookingService = new BookingService(context, couponService);

        // Booking 1 earns an Available coupon
        var b1Req = new CreateBookingDto
        {
            IdempotencyKey = Guid.NewGuid(),
            FlightId = flight1.FlightId,
            PassengerName = "Evan Stone",
            PassengerEmail = "evan@example.com",
            PassengerPhone = "+1 555-4444",
            PassengerAge = 28,
            PassengerGender = "Male",
            Class = "Economy",
            SeatNumber = "10A",
            PassengerCount = 1
        };
        var b1 = await bookingService.CreateBookingAsync(user.Id, b1Req);
        Assert.True(b1.Success, b1.Message);

        var earnedCoupon = await context.Coupons.SingleAsync(c => c.GeneratedForBookingId == b1.Booking!.BookingId);
        Assert.Equal("Available", earnedCoupon.Status);
        Assert.Equal("evan", earnedCoupon.Username);

        var initialCounts = await context.UserCouponCounts.SingleAsync(c => c.UserId == user.Id);
        Assert.Equal(1, initialCounts.AvailableCoupons);
        Assert.Equal(0, initialCounts.UsedCoupons);
        Assert.Equal(1, initialCounts.TotalCoupons);

        // Booking 2 uses this coupon
        var bookingReq = new CreateBookingDto
        {
            IdempotencyKey = Guid.NewGuid(),
            FlightId = flight2.FlightId,
            PassengerName = "Evan Stone",
            PassengerEmail = "evan@example.com",
            PassengerPhone = "+1 555-4444",
            PassengerAge = 28,
            PassengerGender = "Male",
            Class = "Economy",
            SeatNumber = "15B",
            PassengerCount = 1,
            CouponCode = earnedCoupon.CouponCode
        };

        var bookingResult = await bookingService.CreateBookingAsync(user.Id, bookingReq);
        Assert.True(bookingResult.Success, bookingResult.Message);

        // After booking:
        // EVANCP01 is Used (UsedCoupons = 1)
        // Generated reward coupon for the new booking is Pending (PendingCoupons = 1)
        // AvailableCoupons = 0, TotalCoupons = 2
        var countsAfterBooking = await context.UserCouponCounts.SingleAsync(c => c.UserId == user.Id);
        Assert.Equal(0, countsAfterBooking.AvailableCoupons);
        Assert.Equal(1, countsAfterBooking.PendingCoupons);
        Assert.Equal(1, countsAfterBooking.UsedCoupons);
        Assert.Equal(2, countsAfterBooking.TotalCoupons);

        // Now cancel the booking:
        // 1. Used coupon EVANCP01 must be restored to Available.
        // 2. Newly generated reward coupon must be deleted.
        // 3. UserCouponCounts must automatically update to: Available = 1, Pending = 0, Used = 0, Total = 1.
        var cancelResult = await bookingService.CancelBookingAsync(bookingResult.Booking!.BookingId, user.Id);
        Assert.True(cancelResult.Success, cancelResult.Message);

        var countsAfterCancel = await context.UserCouponCounts.SingleAsync(c => c.UserId == user.Id);
        Assert.Equal(1, countsAfterCancel.AvailableCoupons);
        Assert.Equal(0, countsAfterCancel.PendingCoupons);
        Assert.Equal(0, countsAfterCancel.UsedCoupons);
        Assert.Equal(1, countsAfterCancel.TotalCoupons);

        var userAfterCancel = await context.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(1, userAfterCancel.AvailableCoupons);
        Assert.Equal(0, userAfterCancel.PendingCoupons);
        Assert.Equal(0, userAfterCancel.UsedCoupons);
        Assert.Equal(1, userAfterCancel.TotalCoupons);
    }

    private static User CreateUser(int id, string username, string email) => new()
    {
        Id = id,
        FullName = username.ToUpperInvariant(),
        Username = username,
        Email = email,
        PhoneNumber = "+1 555-0100",
        PasswordHash = "hashed_pw",
        Role = "User",
        CreatedAt = DateTime.UtcNow,
        IsActive = true
    };

    private static Flight CreateFlight(int id, decimal distanceKm, DateOnly departureDate) => new()
    {
        FlightId = id,
        FlightNumber = $"SW-{id:000}",
        Airline = "SkyWings",
        FromCity = "New York",
        ToCity = "London",
        DepartureDate = departureDate,
        DepartureTime = "10:00",
        ArrivalDate = departureDate,
        ArrivalTime = "18:00",
        TotalSeats = 100,
        AvailableSeats = 100,
        DistanceKm = distanceKm,
        Price = 1500m,
        Status = "Scheduled"
    };

    private static async Task<SqliteConnection> OpenDatabaseAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
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
}
