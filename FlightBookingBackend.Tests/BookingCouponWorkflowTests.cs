using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using Xunit;

namespace FlightBookingBackend.Tests;

public class BookingCouponWorkflowTests
{
    [Fact]
    public async Task SuccessfulBookingStoresFareAndEarnsPointsFromThePaidAmount()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight(100m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(4));
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var bookingService = new BookingService(context, new CouponService(context));
        var result = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight.FlightId));

        Assert.True(result.Success, result.Message);
        var booking = await context.Bookings.SingleAsync();
        var pointsTransaction = await context.CouponTransactions.SingleAsync();
        var journeyDate = flight.DepartureDate;

        Assert.Equal(journeyDate, booking.FlightJourneyDate);
        Assert.Equal(100m, booking.DistanceKm);
        Assert.Equal(1500m, booking.BaseFare);
        Assert.Equal(0m, booking.Taxes);
        Assert.Equal(1500m, booking.TicketPrice);
        Assert.Equal(0m, booking.DiscountAmount);
        Assert.Equal("Earned", pointsTransaction.TransactionType);
        Assert.Equal("Pending", pointsTransaction.Status);
        Assert.Equal(user.Id, pointsTransaction.UserId);
        Assert.Equal(booking.BookingId, pointsTransaction.BookingId);
        Assert.Equal(15m, pointsTransaction.Points);
        Assert.Equal(15m, result.Booking?.CouponPointsEarned);
        Assert.Equal(0m, result.Booking?.AvailableCouponPoints);

        var coupon = await context.Coupons.SingleAsync();
        var couponDto = (await new CouponService(context).GetAllCouponsAsync(user.Id)).Single();
        Assert.Equal(user.Id, coupon.UserId);
        Assert.Equal(booking.BookingId, coupon.GeneratedForBookingId);
        Assert.Equal(booking.BookingReference, couponDto.BookingReference);
        Assert.Equal(1500m, coupon.OriginalFlightFare);
        Assert.Equal(15m, coupon.CouponPoints);
        Assert.Equal(2m, coupon.DiscountValue);
        Assert.Equal(2m, coupon.DiscountAmount);
        Assert.Equal("Pending", coupon.Status);
        Assert.Equal(1, coupon.TotalUsageLimit);
        Assert.Equal(coupon.CreatedAt.AddYears(1), coupon.ExpiryDate);
        Assert.Equal(coupon.CouponCode, result.Booking?.GeneratedCouponCode);
        Assert.Matches(new Regex("^[A-Z0-9]{8}$"), coupon.CouponCode);
        Assert.Equal(coupon.Status, result.Booking?.GeneratedCouponStatus);
        Assert.Equal(coupon.DiscountAmount, result.Booking?.GeneratedCouponAmount);
        Assert.Equal(coupon.CouponPoints, result.Booking?.GeneratedCouponPoints);
        Assert.Equal(coupon.CouponPoints, couponDto.CouponPoints);
        var summary = await new CouponService(context).GetCouponStatisticsAsync(user.Id);
        Assert.Equal(1, summary.TotalCoupons);
        Assert.Equal(1, summary.PendingCoupons);
    }

    [Fact]
    public void CouponCodeGeneratorProducesUniqueEightCharacterUppercaseAlphanumericCodes()
    {
        var codes = Enumerable.Range(0, 500)
            .Select(_ => CouponCodeGenerator.Generate())
            .ToArray();

        Assert.All(codes, code => Assert.Matches(new Regex("^[A-Z0-9]{8}$"), code));
        Assert.Equal(codes.Length, codes.Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public async Task CouponCodeHasAUniqueDatabaseIndex()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var couponCodeIndex = context.Model
            .FindEntityType(typeof(Coupon))!
            .GetIndexes()
            .Single(index => index.Properties.Any(property => property.Name == nameof(Coupon.CouponCode)));
        Assert.True(couponCodeIndex.IsUnique);
        Assert.Equal(
            "varchar(8)",
            context.Model.FindEntityType(typeof(Coupon))!
                .FindProperty(nameof(Coupon.CouponCode))!
                .GetColumnType());

        var user = CreateUser();
        context.Users.Add(user);
        await context.SaveChangesAsync();
        var coupon = CreateStatisticsCoupon("AB12CD34", "Pending", user.Id);
        context.Coupons.Add(coupon);
        await context.SaveChangesAsync();

        context.Coupons.Add(CreateStatisticsCoupon("AB12CD34", "Pending", user.Id));
        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task RepeatingTheSameBookingRequestReturnsTheOriginalBookingAndCoupon()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight(100m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3));
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var service = new BookingService(context, new CouponService(context));
        var request = CreateBookingRequest(flight.FlightId);

        var firstResponse = await service.CreateBookingAsync(user.Id, request);
        var retryResponse = await service.CreateBookingAsync(user.Id, request);

        Assert.True(firstResponse.Success, firstResponse.Message);
        Assert.True(retryResponse.Success, retryResponse.Message);
        Assert.Equal(firstResponse.Booking?.BookingId, retryResponse.Booking?.BookingId);
        Assert.Equal(firstResponse.Booking?.GeneratedCouponCode, retryResponse.Booking?.GeneratedCouponCode);
        Assert.Equal(1, await context.Bookings.CountAsync());
        Assert.Equal(1, await context.Coupons.CountAsync());
        Assert.Equal(1, await context.CouponTransactions.CountAsync());
        Assert.Equal(1, (await new CouponService(context).GetCouponStatisticsAsync(user.Id)).TotalCoupons);
    }

    [Fact]
    public async Task GeneratedCouponCanBeAppliedOnceToThePassengersNextBooking()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var anotherUser = CreateUser();
        var today = CouponBusinessTime.GetDate(
            DateTimeOffset.UtcNow,
            CouponBusinessTime.ResolveTimeZone(null));
        var firstFlight = CreateFlight(100m, today);
        var nextFlight = CreateFlight(100m, today.AddDays(2));
        context.AddRange(user, anotherUser, firstFlight, nextFlight);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var bookingService = new BookingService(context, couponService);
        var firstBooking = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(firstFlight.FlightId));
        Assert.True(firstBooking.Success, firstBooking.Message);

        var generatedCoupon = Assert.Single(await couponService.GetAllCouponsAsync(user.Id));
        Assert.Equal("Available", generatedCoupon.Status);
        Assert.Equal(firstBooking.Booking?.BookingReference, generatedCoupon.BookingReference);
        Assert.Empty(await couponService.GetAllCouponsAsync(anotherUser.Id));

        var validation = await couponService.ValidateCouponAsync(
            generatedCoupon.CouponCode,
            nextFlight.FlightId,
            "Economy",
            user.Id);
        Assert.True(validation.IsValid, validation.Message);
        Assert.Equal(2m, validation.DiscountAmount);

        var nextBooking = await bookingService.CreateBookingAsync(
            user.Id,
            CreateBookingRequest(nextFlight.FlightId, generatedCoupon.CouponCode));
        Assert.True(nextBooking.Success, nextBooking.Message);
        Assert.Equal(2m, nextBooking.Booking?.DiscountAmount);
        Assert.Equal(1498m, nextBooking.Booking?.FinalAmount);

        context.ChangeTracker.Clear();
        Assert.Equal("Used", await context.Coupons
            .Where(coupon => coupon.CouponId == generatedCoupon.CouponId)
            .Select(coupon => coupon.Status)
            .SingleAsync());
        Assert.Equal(1, await context.CouponUsages.CountAsync(usage => usage.CouponId == generatedCoupon.CouponId));
        Assert.Equal(2m, await context.Bookings
            .Where(booking => booking.BookingId == nextBooking.Booking!.BookingId)
            .Select(booking => booking.DiscountAmount)
            .SingleAsync());
        Assert.False((await couponService.ValidateCouponAsync(
            generatedCoupon.CouponCode,
            nextFlight.FlightId,
            "Economy",
            user.Id)).IsValid);

        var bookingDetail = await bookingService.GetBookingByIdAsync(nextBooking.Booking!.BookingId, user.Id);
        Assert.Equal(generatedCoupon.CouponCode, bookingDetail?.AppliedCouponCode);
    }

    [Fact]
    public async Task PointsEarnedAreCalculatedAsOnePercentOfTheActualBookingAmount()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight(1000m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(4));
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var result = await new BookingService(context, new CouponService(context))
            .CreateBookingAsync(user.Id, CreateBookingRequest(flight.FlightId));

        Assert.True(result.Success, result.Message);
        var pointsTransaction = await context.CouponTransactions.SingleAsync();
        Assert.Equal(10000m, result.Booking?.FinalAmount);
        Assert.Equal(100m, pointsTransaction.Points);
        Assert.Equal(100m, result.Booking?.CouponPointsEarned);
    }

    [Fact]
    public async Task EverySuccessfulBookingGeneratesOnePassengerOwnedPointsTransaction()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var anotherUser = CreateUser();
        var flight1 = CreateFlight(20m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3));
        var flight2 = CreateFlight(30m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));
        var flight3 = CreateFlight(40m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7));
        context.AddRange(user, anotherUser, flight1, flight2, flight3);
        await context.SaveChangesAsync();

        var bookingService = new BookingService(context, new CouponService(context));
        var firstBooking = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight1.FlightId));
        var secondBooking = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight2.FlightId));
        var anotherPassengerBooking = await bookingService.CreateBookingAsync(anotherUser.Id, CreateBookingRequest(flight3.FlightId));

        Assert.True(firstBooking.Success, firstBooking.Message);
        Assert.True(secondBooking.Success, secondBooking.Message);
        Assert.True(anotherPassengerBooking.Success, anotherPassengerBooking.Message);
        Assert.Equal(2, await context.CouponTransactions.CountAsync(c => c.UserId == user.Id));
        Assert.Equal(1, await context.CouponTransactions.CountAsync(c => c.UserId == anotherUser.Id));
        Assert.Equal(3, await context.Coupons.CountAsync());
        Assert.Equal(
            new int?[] { firstBooking.Booking!.BookingId, secondBooking.Booking!.BookingId, anotherPassengerBooking.Booking!.BookingId }.OrderBy(id => id),
            await context.CouponTransactions
                .OrderBy(c => c.BookingId)
                .Select(c => c.BookingId)
                .ToArrayAsync());
    }

    [Fact]
    public async Task RedeemingPointsAppliesTheConvertedDiscountOnceAndRefreshesTheBalance()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var sourceFlight = CreateFlight(1000m, DateOnly.FromDateTime(DateTime.UtcNow));
        var redemptionFlight = CreateFlight(200m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(4));
        context.AddRange(user, sourceFlight, redemptionFlight);
        await context.SaveChangesAsync();

        var service = new BookingService(context, new CouponService(context));
        var sourceBooking = await service.CreateBookingAsync(user.Id, CreateBookingRequest(sourceFlight.FlightId));
        Assert.True(sourceBooking.Success, sourceBooking.Message);

        var balanceBeforeRedemption = await new CouponService(context).GetCouponBalanceAsync(user.Id);
        Assert.Equal(100m, balanceBeforeRedemption.AvailablePoints);
        Assert.Equal(10m, balanceBeforeRedemption.AvailableDiscountAmount);

        var redemptionRequest = CreateBookingRequest(redemptionFlight.FlightId);
        redemptionRequest.RedeemCouponPoints = true;
        var redemption = await service.CreateBookingAsync(user.Id, redemptionRequest);

        Assert.True(redemption.Success, redemption.Message);
        Assert.Equal(100m, redemption.Booking?.PointsRedeemed);
        Assert.Equal(10m, redemption.Booking?.PointsDiscountAmount);
        Assert.Equal(1990m, redemption.Booking?.FinalAmount);
        Assert.Equal(20m, redemption.Booking?.CouponPointsEarned);
        Assert.Equal(10m, await context.Bookings
            .Where(booking => booking.BookingId == redemption.Booking!.BookingId)
            .Select(booking => booking.DiscountAmount)
            .SingleAsync());

        context.ChangeTracker.Clear();
        var couponService = new CouponService(context);
        var balanceAfterRedemption = await couponService.GetCouponBalanceAsync(user.Id);
        Assert.Equal(0m, balanceAfterRedemption.AvailablePoints);
        Assert.Equal(20m, balanceAfterRedemption.PendingPoints);
        Assert.Equal(100m, balanceAfterRedemption.RedeemedPoints);
        Assert.Equal(120m, balanceAfterRedemption.TotalPoints);
        Assert.Equal(1, await context.CouponTransactions.CountAsync(t => t.TransactionType == "Redeemed"));

        var cancelEarnedBooking = await service.CancelBookingAsync(sourceBooking.Booking!.BookingId, user.Id);
        Assert.True(cancelEarnedBooking.Success);
        Assert.Equal("Cancelled", await context.Bookings
            .Where(booking => booking.BookingId == sourceBooking.Booking.BookingId)
            .Select(booking => booking.BookingStatus)
            .SingleAsync());
    }

    [Fact]
    public async Task PointsRedemptionCannotDiscountMoreThanTheFare()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var sourceFlight = CreateFlight(20m, DateOnly.FromDateTime(DateTime.UtcNow));
        var redemptionFlight = CreateFlight(20m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(4));
        context.AddRange(user, sourceFlight, redemptionFlight);
        await context.SaveChangesAsync();

        var service = new BookingService(context, new CouponService(context));
        var sourceBooking = await service.CreateBookingAsync(user.Id, CreateBookingRequest(sourceFlight.FlightId));
        Assert.True(sourceBooking.Success, sourceBooking.Message);
        var earnedTransaction = await context.CouponTransactions.SingleAsync();
        earnedTransaction.Points = 20000m;
        await context.SaveChangesAsync();

        var request = CreateBookingRequest(redemptionFlight.FlightId);
        request.RedeemCouponPoints = true;
        var result = await service.CreateBookingAsync(user.Id, request);

        Assert.True(result.Success, result.Message);
        Assert.Equal(1500m, result.Booking?.PointsDiscountAmount);
        Assert.Equal(15000m, result.Booking?.PointsRedeemed);
        Assert.Equal(0m, result.Booking?.FinalAmount);
        Assert.Equal(5000m, (await new CouponService(context).GetCouponBalanceAsync(user.Id)).AvailablePoints);
        var zeroValueReward = await context.Coupons
            .SingleAsync(coupon => coupon.GeneratedForBookingId == result.Booking!.BookingId);
        Assert.Equal(0m, zeroValueReward.CouponPoints);
        Assert.Equal(0m, zeroValueReward.DiscountAmount);
        Assert.Equal("Pending", zeroValueReward.Status);
    }

    [Fact]
    public async Task PendingCouponsDoNotIncludePointsInAvailableBalanceUntilAvailable()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        // Flight departs 5 days in the future
        var futureFlight = CreateFlight(1000m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));
        context.AddRange(user, futureFlight);
        await context.SaveChangesAsync();

        var service = new BookingService(context, new CouponService(context));
        var bookingResult = await service.CreateBookingAsync(user.Id, CreateBookingRequest(futureFlight.FlightId));
        Assert.True(bookingResult.Success, bookingResult.Message);

        var coupon = await context.Coupons.SingleAsync(c => c.GeneratedForBookingId == bookingResult.Booking!.BookingId);
        Assert.Equal("Pending", coupon.Status);
        Assert.True(coupon.CouponPoints > 0m);

        // Verify balance: AvailablePoints must ONLY include Available coupons, NOT Pending
        var couponService = new CouponService(context);
        var balance = await couponService.GetCouponBalanceAsync(user.Id);
        Assert.Equal(0m, balance.AvailablePoints);
        Assert.Equal(0m, balance.AvailableDiscountAmount);
        Assert.Equal(coupon.CouponPoints, balance.PendingPoints);
        Assert.Equal(coupon.CouponPoints, balance.TotalPoints);

        // When the flight date arrives, status updates to Available and points become available
        futureFlight.DepartureDate = DateOnly.FromDateTime(DateTime.UtcNow);
        await context.SaveChangesAsync();

        var refreshedBalance = await couponService.GetCouponBalanceAsync(user.Id);
        Assert.Equal(coupon.CouponPoints, refreshedBalance.AvailablePoints);
        Assert.Equal(0m, refreshedBalance.PendingPoints);
        Assert.Equal(Math.Floor(coupon.CouponPoints / 10m), refreshedBalance.AvailableDiscountAmount);
    }

    [Fact]
    public async Task CancellingAnUnredeemedBookingCancelsItsEarnedPoints()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight(20m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3));
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var result = await new BookingService(context, new CouponService(context))
            .CreateBookingAsync(user.Id, CreateBookingRequest(flight.FlightId));
        Assert.True(result.Success, result.Message);

        var cancelled = await new BookingService(context, new CouponService(context))
            .CancelBookingAsync(result.Booking!.BookingId, user.Id);

        Assert.True(cancelled.Success, cancelled.Message);
        Assert.Equal("Cancelled", await context.CouponTransactions
            .Select(transaction => transaction.Status)
            .SingleAsync());
        Assert.Equal(0m, (await new CouponService(context).GetCouponBalanceAsync(user.Id)).TotalPoints);
    }

    [Fact]
    public async Task ApplyingOwnedAvailableCouponUsesItOnceAndUpdatesItsStatus()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var anotherUser = CreateUser();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var earnedOnFlight = CreateFlight(20m, today);
        var newFlight = CreateFlight(30m, today.AddDays(3));
        earnedOnFlight.Price = 1500m;
        context.AddRange(user, anotherUser, earnedOnFlight, newFlight);
        await context.SaveChangesAsync();

        var originalBooking = CreateConfirmedBooking(user.Id, earnedOnFlight.FlightId, today);
        context.Bookings.Add(originalBooking);
        await context.SaveChangesAsync();

        var coupon = CreateCoupon("OWNED", originalBooking, today);
        coupon.OriginalFlightFare = 1500m;
        coupon.DiscountValue = 200m;
        coupon.DiscountAmount = 200m;
        coupon.MaximumDiscount = 200m;
        coupon.DiscountPercentage = 0m;
        coupon.Status = "Available";
        context.Coupons.Add(coupon);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var validForOwner = await couponService.ValidateCouponAsync("OWNED", newFlight.FlightId, "Economy", user.Id);
        var invalidForOtherPassenger = await couponService.ValidateCouponAsync("OWNED", newFlight.FlightId, "Economy", anotherUser.Id);

        Assert.True(validForOwner.IsValid);
        Assert.Equal(200m, validForOwner.DiscountAmount);
        Assert.False(invalidForOtherPassenger.IsValid);

        var result = await new BookingService(context, couponService)
            .CreateBookingAsync(user.Id, CreateBookingRequest(newFlight.FlightId, "OWNED"));

        Assert.True(result.Success, result.Message);
        Assert.Equal(200m, result.Booking?.DiscountAmount);
        Assert.Equal(1300m, result.Booking?.FinalAmount);
        Assert.Equal(200m, await context.Bookings
            .Where(booking => booking.BookingId == result.Booking!.BookingId)
            .Select(booking => booking.DiscountAmount)
            .SingleAsync());
        Assert.Equal("Used", await context.Coupons.Where(c => c.CouponId == coupon.CouponId).Select(c => c.Status).SingleAsync());
        Assert.Equal(1, await context.CouponUsages.CountAsync(cu => cu.CouponId == coupon.CouponId));

        var repeatedUse = await couponService.ValidateCouponAsync("OWNED", newFlight.FlightId, "Economy", user.Id);
        Assert.False(repeatedUse.IsValid);
    }

    [Fact]
    public async Task FixedCouponDiscountCannotExceedTheEligibleFare()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var earnedOnFlight = CreateFlight(20m, today);
        var newFlight = CreateFlight(1m, today.AddDays(3));
        context.AddRange(user, earnedOnFlight, newFlight);
        await context.SaveChangesAsync();

        var originalBooking = CreateConfirmedBooking(user.Id, earnedOnFlight.FlightId, today);
        context.Bookings.Add(originalBooking);
        await context.SaveChangesAsync();

        var coupon = CreateCoupon("CAP-200", originalBooking, today);
        coupon.DiscountValue = 2500m;
        coupon.DiscountAmount = 2500m;
        coupon.MaximumDiscount = 2500m;
        coupon.DiscountPercentage = 0m;
        coupon.Status = "Available";
        context.Coupons.Add(coupon);
        await context.SaveChangesAsync();

        var result = await new CouponService(context)
            .ValidateCouponAsync("CAP-200", newFlight.FlightId, "Economy", user.Id);

        Assert.True(result.IsValid, result.Message);
        Assert.Equal(1500m, result.DiscountAmount);
        Assert.Equal(0m, result.FinalPrice);
    }

    [Fact]
    public async Task FailedBookingDoesNotConsumeItsSelectedCoupon()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var earnedOnFlight = CreateFlight(20m, today);
        var bookedFlight = CreateFlight(30m, today.AddDays(3));
        context.AddRange(user, earnedOnFlight, bookedFlight);
        await context.SaveChangesAsync();

        var originalBooking = CreateConfirmedBooking(user.Id, earnedOnFlight.FlightId, today);
        var existingSeatBooking = CreateConfirmedBooking(user.Id, bookedFlight.FlightId, bookedFlight.DepartureDate);
        context.Bookings.AddRange(originalBooking, existingSeatBooking);
        await context.SaveChangesAsync();

        var coupon = CreateCoupon("FAILED-BOOKING", originalBooking, today);
        coupon.Status = "Available";
        context.Coupons.Add(coupon);
        await context.SaveChangesAsync();

        var result = await new BookingService(context, new CouponService(context))
            .CreateBookingAsync(user.Id, CreateBookingRequest(bookedFlight.FlightId, coupon.CouponCode));

        Assert.False(result.Success);
        Assert.Equal("Available", await context.Coupons
            .Where(c => c.CouponId == coupon.CouponId)
            .Select(c => c.Status)
            .SingleAsync());
        Assert.Equal(0, await context.CouponUsages.CountAsync(cu => cu.CouponId == coupon.CouponId));
        Assert.Equal(2, await context.Bookings.CountAsync());
        Assert.Equal(0, await context.CouponTransactions.CountAsync());
        Assert.Equal(originalBooking.BookingId, await context.Coupons
            .Select(coupon => coupon.GeneratedForBookingId)
            .SingleAsync());
    }

    [Fact]
    public async Task PendingCouponBecomesAvailableOnItsFlightDateButNotBefore()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var today = new DateOnly(2026, 10, 12);
        var fixedNow = new DateTimeOffset(2026, 10, 11, 19, 0, 0, TimeSpan.Zero);
        var user = CreateUser();
        var dueFlight = CreateFlight(20m, today);
        var futureFlight = CreateFlight(30m, today.AddDays(1));
        var expiredFlight = CreateFlight(40m, today.AddDays(20));
        context.AddRange(user, dueFlight, futureFlight, expiredFlight);
        await context.SaveChangesAsync();

        var dueBooking = CreateConfirmedBooking(user.Id, dueFlight.FlightId, today.AddDays(-10));
        var futureBooking = CreateConfirmedBooking(user.Id, futureFlight.FlightId, today.AddDays(-10));
        var expiredBooking = CreateConfirmedBooking(user.Id, expiredFlight.FlightId, today.AddDays(-10));
        context.AddRange(dueBooking, futureBooking, expiredBooking);
        await context.SaveChangesAsync();

        var dueCoupon = CreateCoupon("DUE", dueBooking, today);
        var futureCoupon = CreateCoupon("FUTURE", futureBooking, today.AddDays(1));
        var expiredPendingCoupon = CreateCoupon("EXPIRED-PENDING", expiredBooking, today.AddDays(20));
        expiredPendingCoupon.ExpiryDate = fixedNow.UtcDateTime.AddSeconds(-1);
        context.Coupons.AddRange(dueCoupon, futureCoupon, expiredPendingCoupon);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context, timeProvider: new FixedTimeProvider(fixedNow));
        var coupons = (await couponService.GetAllCouponsAsync(user.Id)).ToDictionary(coupon => coupon.CouponCode);

        Assert.Equal("Available", coupons["DUE"].Status);
        Assert.Equal("Pending", coupons["FUTURE"].Status);
        Assert.Equal("Expired", coupons["EXPIRED-PENDING"].Status);
        Assert.Equal(new DateOnly(2026, 10, 12), couponService.GetBusinessDate());
        var statistics = await couponService.GetCouponStatisticsAsync(user.Id);
        Assert.Equal(1, statistics.AvailableCoupons);
        Assert.Equal(1, statistics.PendingCoupons);
        Assert.Equal(1, statistics.ExpiredCoupons);
        Assert.Equal(3, statistics.TotalCoupons);
        Assert.Equal(
            TimeSpan.FromHours(23.5),
            CouponBusinessTime.UntilNextDateBoundary(fixedNow, CouponBusinessTime.ResolveTimeZone(null)));
    }

    [Fact]
    public async Task CouponStatisticsIncludesEveryNonOverlappingStatusAndAllPassengerCoupons()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var anotherUser = CreateUser();
        context.Users.Add(user);
        context.Users.Add(anotherUser);
        await context.SaveChangesAsync();
        context.Coupons.AddRange(
            CreateStatisticsCoupon("AVAILABLE-1", "Available", user.Id),
            CreateStatisticsCoupon("AVAILABLE-2", "Available", user.Id),
            CreateStatisticsCoupon("PENDING-1", "Pending", user.Id),
            CreateStatisticsCoupon("PENDING-2", "Pending", user.Id),
            CreateStatisticsCoupon("PENDING-3", "Pending", user.Id),
            CreateStatisticsCoupon("USED-1", "Used", user.Id),
            CreateStatisticsCoupon("USED-2", "Used", user.Id),
            CreateStatisticsCoupon("USED-3", "Used", user.Id),
            CreateStatisticsCoupon("USED-4", "Used", user.Id),
            CreateStatisticsCoupon("EXPIRED-1", "Expired", user.Id),
            CreateStatisticsCoupon("EXPIRED-2", "Expired", user.Id),
            CreateStatisticsCoupon("INACTIVE-1", "Inactive", user.Id),
            CreateStatisticsCoupon("OTHER-USER", "Available", anotherUser.Id));
        await context.SaveChangesAsync();

        var stats = await new CouponService(context).GetCouponStatisticsAsync(user.Id);

        Assert.Equal(2, stats.AvailableCoupons);
        Assert.Equal(3, stats.PendingCoupons);
        Assert.Equal(4, stats.UsedCoupons);
        Assert.Equal(3, stats.ExpiredCoupons);
        Assert.Equal(12, stats.TotalCoupons);
        Assert.Equal(
            stats.AvailableCoupons + stats.PendingCoupons + stats.UsedCoupons + stats.ExpiredCoupons,
            stats.TotalCoupons);
    }

    [Fact]
    public async Task DatabaseRejectsDuplicatePointEarningForTheSameBooking()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight(20m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3));
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var result = await new BookingService(context, new CouponService(context))
            .CreateBookingAsync(user.Id, CreateBookingRequest(flight.FlightId));
        Assert.True(result.Success, result.Message);
        Assert.Equal(
            result.Booking!.BookingId,
            await context.CouponTransactions.AsNoTracking().Select(c => c.BookingId).SingleAsync());

        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'UX_CouponTransactions_Booking_Type'";
        var indexSql = (string?)await command.ExecuteScalarAsync();
        Assert.Contains("UNIQUE", indexSql ?? string.Empty, StringComparison.OrdinalIgnoreCase);

        await using var duplicateCommand = connection.CreateCommand();
        duplicateCommand.CommandText = """
            INSERT INTO CouponTransactions
                (UserId, BookingId, TransactionType, Points, DiscountAmount, Status, TransactionDate)
            VALUES
                ($userId, $bookingId, 'Earned', 15, 0, 'Available', '2026-01-01')
            """;
        duplicateCommand.Parameters.AddWithValue("$userId", user.Id);
        duplicateCommand.Parameters.AddWithValue("$bookingId", result.Booking.BookingId);
        await Assert.ThrowsAsync<SqliteException>(() => duplicateCommand.ExecuteNonQueryAsync());
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

    private static Flight CreateFlight(decimal distanceKm, DateOnly departureDate) => new()
    {
        FlightNumber = "TEST-100",
        Airline = "Test Airways",
        FromCity = "Chennai",
        ToCity = "Bangalore",
        DepartureDate = departureDate,
        DepartureTime = "10:00",
        ArrivalDate = departureDate,
        ArrivalTime = "11:00",
        Duration = "1h",
        DistanceKm = distanceKm,
        TotalSeats = 10,
        AvailableSeats = 10,
        Price = Math.Max(distanceKm * FlightFareCalculator.FarePerKilometer, FlightFareCalculator.MinimumEconomyFare),
        Status = "Scheduled"
    };

    private static CreateBookingDto CreateBookingRequest(int flightId, string? couponCode = null) => new()
    {
        IdempotencyKey = Guid.NewGuid(),
        FlightId = flightId,
        PassengerName = "Test Passenger",
        PassengerEmail = "passenger@example.test",
        PassengerPhone = "555-0100",
        PassengerAge = 30,
        PassengerGender = "Other",
        SeatNumber = "1A",
        Class = "Economy",
        CouponCode = couponCode
    };

    private static Coupon CreateCoupon(string code, Booking booking, DateOnly availableFromDate) => new()
    {
        CouponCode = code,
        Description = "Test coupon",
        DiscountType = "Fixed",
        DiscountValue = 200m,
        OriginalFlightFare = 25000m,
        DiscountPercentage = 0m,
        DiscountAmount = 200m,
        MinimumAmount = 0m,
        MaximumDiscount = 200m,
        ExpiryDate = DateTime.UtcNow.AddDays(60),
        TotalUsageLimit = 1,
        UsedCount = 0,
        Status = "Pending",
        UserId = booking.UserId,
        GeneratedForBookingId = booking.BookingId,
        JourneyDate = availableFromDate,
        AvailableFromDate = availableFromDate
    };

    private static Coupon CreateStatisticsCoupon(string code, string status, int userId) => new()
    {
        CouponCode = code,
        Description = "Statistics test coupon",
        DiscountType = "Fixed",
        DiscountValue = 200m,
        OriginalFlightFare = 25000m,
        DiscountPercentage = 0m,
        DiscountAmount = 200m,
        MinimumAmount = 0m,
        MaximumDiscount = 200m,
        ExpiryDate = DateTime.UtcNow.AddDays(30),
        TotalUsageLimit = 1,
        UsedCount = status == "Used" ? 1 : 0,
        Status = status,
        UserId = userId
    };

    private static Booking CreateConfirmedBooking(int userId, int flightId, DateOnly journeyDate) => new()
    {
        BookingReference = $"TEST-{Guid.NewGuid():N}",
        UserId = userId,
        FlightId = flightId,
        PassengerName = "Test Passenger",
        PassengerEmail = "passenger@example.test",
        PassengerPhone = "555-0100",
        PassengerAge = 30,
        PassengerGender = "Other",
        SeatNumber = "1A",
        Class = "Economy",
        BookingDate = DateTime.UtcNow.AddDays(-10),
        FlightJourneyDate = journeyDate,
        DistanceKm = 20m,
        BaseFare = 1500m,
        Taxes = 0m,
        TicketPrice = 1500m,
        BookingStatus = "Confirmed",
        PaymentStatus = "Paid"
    };

    [Theory]
    [InlineData("IndiGo", "Business", 2, 10000, 200, 20, 9980)]
    [InlineData("SpiceJet", "Business", 1, 10000, 100, 10, 9990)]
    [InlineData("IndiGo", "Economy", 2, 10000, 200, 20, 9980)]
    [InlineData("SpiceJet", "First", 1, 10000, 100, 10, 9990)]
    [InlineData("British Airways", "Business", 2, 10000, 200, 20, 9980)]
    [InlineData("British Airways", "Economy", 1, 10000, 100, 10, 9990)]
    [InlineData("Air India", "Business", 2, 10000, 200, 20, 9980)]
    [InlineData("Air India", "Economy", 1, 10000, 100, 10, 9990)]
    [InlineData("British Airways", "First", 2, 10000, 200, 20, 9980)]
    public void AirlineAndClassPercentageAndPointsFormulaVerification(
        string airline,
        string travellerClass,
        decimal expectedPercentage,
        decimal totalFare,
        int expectedPoints,
        int expectedDiscount,
        int expectedFinalFare)
    {
        var percentage = AirlineClassCouponCalculator.GetPercentage(airline, travellerClass);
        Assert.Equal(expectedPercentage, percentage);

        var points = AirlineClassCouponCalculator.CalculatePoints(totalFare, percentage);
        Assert.Equal(expectedPoints, points);

        var discount = AirlineClassCouponCalculator.CalculateDiscount(points);
        Assert.Equal(expectedDiscount, discount);

        var finalFare = AirlineClassCouponCalculator.CalculateFinalFare((int)totalFare, discount);
        Assert.Equal(expectedFinalFare, finalFare);
    }

    [Fact]
    public async Task BookingWithAirlineAndClassCalculatesPointsAndIntegerFinalFareCorrectly()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        // IndiGo flight with 1000km -> 10,000 base fare
        var flight = CreateFlight(1000m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));
        flight.Airline = "IndiGo";
        flight.Price = 10000m;
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var bookingService = new BookingService(context, new CouponService(context));
        var req = CreateBookingRequest(flight.FlightId);
        req.Class = "Business"; // IndiGo Business -> 2%

        var result = await bookingService.CreateBookingAsync(user.Id, req);
        Assert.True(result.Success, result.Message);

        // Class fare for Business is base * 1.5 = 15,000
        Assert.Equal(15000m, result.Booking?.BaseFare);
        // Points = (15,000 * 2) / 100 = 300 points
        Assert.Equal(300m, result.Booking?.CouponPointsEarned);
        Assert.Equal(2m, result.Booking?.GeneratedCouponPercentage);
        // Discount on generated coupon = 300 / 10 = ₹30
        Assert.Equal(30m, result.Booking?.GeneratedCouponAmount);

        // Now verify coupon details stored in DB
        var coupon = await context.Coupons.SingleAsync(c => c.UserId == user.Id);
        Assert.Equal(300m, coupon.CouponPoints);
        Assert.Equal(2m, coupon.DiscountPercentage);
        Assert.Equal(30m, coupon.DiscountAmount);
        Assert.Equal(15000m, coupon.OriginalFlightFare);
    }

    [Fact]
    public async Task DoubleDiscountIsPreventedWhenCouponAndPointsRedemptionAreBothRequested()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var today = CouponBusinessTime.GetDate(DateTimeOffset.UtcNow, CouponBusinessTime.ResolveTimeZone(null));
        var flight1 = CreateFlight(1000m, today);
        flight1.Airline = "IndiGo";
        var flight2 = CreateFlight(1000m, today.AddDays(2));
        flight2.Airline = "IndiGo";
        context.AddRange(user, flight1, flight2);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var bookingService = new BookingService(context, couponService);

        // 1st booking earns coupon
        var b1 = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight1.FlightId));
        Assert.True(b1.Success);

        var coupon = Assert.Single(await couponService.GetAllCouponsAsync(user.Id));
        Assert.Equal("Available", coupon.Status);

        // Now attempt 2nd booking with BOTH coupon and RedeemCouponPoints = true
        var b2Req = CreateBookingRequest(flight2.FlightId, coupon.CouponCode);
        b2Req.RedeemCouponPoints = true;

        var b2 = await bookingService.CreateBookingAsync(user.Id, b2Req);
        Assert.True(b2.Success);

        // Only the coupon discount should be applied, pointsDiscountAmount should be 0 to prevent double discount
        Assert.Equal(0m, b2.Booking?.PointsDiscountAmount);
        Assert.Equal(coupon.DiscountAmount, b2.Booking?.DiscountAmount);
    }

    [Fact]
    public async Task CancelledTicketPermanentlyDeletesGeneratedCouponAndIsNotShownAsExpired()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var flight = CreateFlight(100m, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(4));
        flight.Airline = "IndiGo";
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var bookingService = new BookingService(context, couponService);

        var bookingResult = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight.FlightId));
        Assert.True(bookingResult.Success);
        var bookingId = bookingResult.Booking!.BookingId;

        // Verify coupon was generated in database
        Assert.True(await context.Coupons.AnyAsync(c => c.GeneratedForBookingId == bookingId));

        // Cancel the booking
        var cancelResult = await bookingService.CancelBookingAsync(bookingId, user.Id);
        Assert.True(cancelResult.Success);

        // 1. Newly generated coupon must be permanently deleted from the database
        Assert.False(await context.Coupons.AnyAsync(c => c.GeneratedForBookingId == bookingId));

        // 2. Coupon must not be shown as Expired or in GetAllCoupons
        var allCoupons = await couponService.GetAllCouponsAsync(user.Id);
        Assert.Empty(allCoupons);

        var stats = await couponService.GetCouponStatisticsAsync(user.Id);
        Assert.Equal(0, stats.TotalCoupons);
        Assert.Equal(0, stats.ExpiredCoupons);
    }

    [Fact]
    public async Task CouponsUsedForCancelledTicketMustNotRemainInUsedStatusAndMustChangeBackToAvailable()
    {
        await using var connection = await OpenDatabaseAsync();
        await using var context = CreateContext(connection);
        await context.Database.EnsureCreatedAsync();

        var user = CreateUser();
        var today = CouponBusinessTime.GetDate(DateTimeOffset.UtcNow, CouponBusinessTime.ResolveTimeZone(null));
        var flight1 = CreateFlight(100m, today);
        flight1.Airline = "IndiGo";
        var flight2 = CreateFlight(100m, today.AddDays(3));
        flight2.Airline = "IndiGo";
        context.AddRange(user, flight1, flight2);
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var bookingService = new BookingService(context, couponService);

        // 1st booking earns an available coupon
        var b1 = await bookingService.CreateBookingAsync(user.Id, CreateBookingRequest(flight1.FlightId));
        Assert.True(b1.Success);

        var earnedCoupon = Assert.Single(await couponService.GetAllCouponsAsync(user.Id));
        Assert.Equal("Available", earnedCoupon.Status);

        // 2nd booking applies that coupon
        var b2Req = CreateBookingRequest(flight2.FlightId, earnedCoupon.CouponCode);
        var b2 = await bookingService.CreateBookingAsync(user.Id, b2Req);
        Assert.True(b2.Success);

        // After applying, coupon status is "Used"
        context.ChangeTracker.Clear();
        var couponAfterApply = await context.Coupons.SingleAsync(c => c.CouponCode == earnedCoupon.CouponCode);
        Assert.Equal("Used", couponAfterApply.Status);
        Assert.Equal(1, couponAfterApply.UsedCount);
        Assert.True(await context.CouponUsages.AnyAsync(u => u.BookingId == b2.Booking!.BookingId));

        // Cancel the 2nd booking (the ticket where the coupon was used)
        var cancelResult = await bookingService.CancelBookingAsync(b2.Booking!.BookingId, user.Id);
        Assert.True(cancelResult.Success);

        // The coupon used for the cancelled ticket must NOT remain in Used status; it must be changed back to Available
        context.ChangeTracker.Clear();
        var couponAfterCancel = await context.Coupons.SingleAsync(c => c.CouponCode == earnedCoupon.CouponCode);
        Assert.Equal("Available", couponAfterCancel.Status);
        Assert.Equal(0, couponAfterCancel.UsedCount);

        // The coupon usage for the cancelled booking must be removed
        Assert.False(await context.CouponUsages.AnyAsync(u => u.BookingId == b2.Booking!.BookingId));

        // RefreshStatusesAsync must not revert it to "Used"
        await couponService.RefreshStatusesAsync();
        context.ChangeTracker.Clear();
        var couponAfterRefresh = await context.Coupons.SingleAsync(c => c.CouponCode == earnedCoupon.CouponCode);
        Assert.Equal("Available", couponAfterRefresh.Status);
        Assert.Equal(0, couponAfterRefresh.UsedCount);

        // Newly generated coupon for the 2nd cancelled ticket must be permanently deleted
        Assert.False(await context.Coupons.AnyAsync(c => c.GeneratedForBookingId == b2.Booking!.BookingId));
    }

    private sealed class FixedTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utcNow;

        public FixedTimeProvider(DateTimeOffset utcNow)
        {
            _utcNow = utcNow;
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }
}

