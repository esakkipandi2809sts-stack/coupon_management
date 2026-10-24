using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Services
{
    public class BookingService : IBookingService
    {
        private readonly FlightBookingDbContext _context;
        private readonly ICouponService _couponService;

        public BookingService(FlightBookingDbContext context, ICouponService couponService)
        {
            _context = context;
            _couponService = couponService;
        }

        public async Task<(bool Success, string Message, BookingDetailDto? Booking)> CreateBookingAsync(int userId, CreateBookingDto dto)
        {
            if (dto.IdempotencyKey == Guid.Empty)
            {
                return (false, "A valid booking request key is required.", null);
            }

            var existingRequest = await GetBookingByIdempotencyKeyAsync(userId, dto.IdempotencyKey);
            if (existingRequest != null)
            {
                return (true, "Booking confirmed successfully!", MapToDetailDto(existingRequest));
            }

            if (!FlightFareCalculator.IsSupportedClass(dto.Class))
            {
                return (false, "Travel class must be All, Economy, Premium Economy, Business, or First Class.", null);
            }
            if (dto.PassengerCount < 1 || dto.PassengerCount > 27)
            {
                return (false, "Passenger count must be between 1 and 27.", null);
            }
            // All is a search/filter option, not a booking class. Default it to Economy.
            dto.Class = string.IsNullOrWhiteSpace(dto.Class) || string.Equals(dto.Class.Trim(), "All", StringComparison.OrdinalIgnoreCase)
                ? "Economy"
                : dto.Class.Trim();

            // 1. Validate User
            var user = await _context.Users.FindAsync(userId);
            if (user == null || !user.IsActive)
            {
                return (false, "User account not found or disabled.", null);
            }

            // 2. Validate Flight
            var flight = await _context.Flights.FindAsync(dto.FlightId);
            if (flight == null)
            {
                return (false, "Flight not found.", null);
            }

            // 3. Check seat availability
            if (flight.AvailableSeats < dto.PassengerCount)
            {
                return (false, $"Only {flight.AvailableSeats} seats are available for this flight.", null);
            }

            var distanceKm = flight.DistanceKm ?? 0m;
            if (flight.Price <= 0m && distanceKm <= 0m)
            {
                return (false, "A valid base fare or route distance must be configured for this flight before it can be booked.", null);
            }

            // Flight.Price is the database-stored Economy/base fare. Apply the selected-class
            // multiplier once, then multiply by the requested passenger count.
            var originalBaseFare = flight.Price > 0m
                ? flight.Price
                : FlightFareCalculator.CalculateEconomyFare(distanceKm);
            var farePerPassenger = (int)Math.Round(FlightFareCalculator.CalculateClassFare(originalBaseFare, dto.Class), 0, MidpointRounding.AwayFromZero);
            var baseFare = (int)Math.Round(farePerPassenger * (decimal)dto.PassengerCount, 0, MidpointRounding.AwayFromZero);
            var taxes = 0m;
            decimal couponDiscountAmount = 0m;
            Coupon? appliedCoupon = null;

            // Percentage based on airline and traveller class
            var percentage = AirlineClassCouponCalculator.GetPercentage(flight.Airline, dto.Class);

            // 4. Validate Coupon if provided
            if (!string.IsNullOrWhiteSpace(dto.CouponCode))
            {
                var couponValidation = await _couponService.ValidateCouponAsync(dto.CouponCode, flight.FlightId, dto.Class, userId, dto.PassengerCount);
                if (!couponValidation.IsValid)
                {
                    return (false, $"Coupon invalid: {couponValidation.Message}", null);
                }

                couponDiscountAmount = Math.Round(couponValidation.DiscountAmount, 0, MidpointRounding.AwayFromZero);
                var normalizedCouponCode = dto.CouponCode.Trim().ToUpperInvariant();
                appliedCoupon = await _context.Coupons.FirstOrDefaultAsync(c =>
                    c.CouponCode == normalizedCouponCode ||
                    c.LegacyCouponCode == normalizedCouponCode);
            }

            // 5. Generate Unique Booking Reference
            string bookingReference;
            do
            {
                bookingReference = $"FLT-{DateTime.UtcNow.Year}-{Random.Shared.Next(100000, 999999)}";
            }
            while (await _context.Bookings.AnyAsync(b => b.BookingReference == bookingReference));

            using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            try
            {
                await _context.Entry(flight).ReloadAsync();

                var normalizedSeatNumber = dto.SeatNumber.Trim().ToUpperInvariant();
                var seatAlreadyBooked = await _context.Bookings.AnyAsync(booking =>
                    booking.FlightId == flight.FlightId &&
                    booking.SeatNumber == normalizedSeatNumber &&
                    booking.BookingStatus != BookingStatuses.Cancelled &&
                    booking.BookingStatus != BookingStatuses.Failed);
                if (seatAlreadyBooked)
                {
                    await transaction.RollbackAsync();
                    return (false, "This seat has already been booked for the selected flight.", null);
                }

                if (flight.AvailableSeats < dto.PassengerCount)
                {
                    await transaction.RollbackAsync();
                    return (false, $"Only {flight.AvailableSeats} seats are available for this flight.", null);
                }

                var balanceTransactions = await _context.CouponTransactions
                    .Where(couponTransaction => couponTransaction.UserId == userId &&
                                                ((couponTransaction.TransactionType == "Earned" &&
                                                  couponTransaction.Status == "Available") ||
                                                 (couponTransaction.TransactionType == "Redeemed" &&
                                                  couponTransaction.Status == "Redeemed")))
                    .Select(couponTransaction => new
                    {
                        couponTransaction.TransactionType,
                        couponTransaction.Points
                    })
                    .ToListAsync();
                var availableEarnedPoints = balanceTransactions
                    .Where(couponTransaction => couponTransaction.TransactionType == "Earned")
                    .Sum(couponTransaction => couponTransaction.Points);
                var previouslyRedeemedPoints = balanceTransactions
                    .Where(couponTransaction => couponTransaction.TransactionType == "Redeemed")
                    .Sum(couponTransaction => couponTransaction.Points);
                var availableCouponPoints = Math.Max(0m, availableEarnedPoints - previouslyRedeemedPoints);
                var remainingFareAfterCoupon = Math.Max(0m, baseFare - couponDiscountAmount);

                // Prevent double discount application: If a coupon is applied, do not also redeem points discount
                var pointsDiscountAmount = (dto.RedeemCouponPoints && appliedCoupon == null)
                    ? Math.Floor(Math.Min(availableCouponPoints / 10m, remainingFareAfterCoupon))
                    : 0m;
                var pointsRedeemed = pointsDiscountAmount * 10m;
                var discountAmount = Math.Round(couponDiscountAmount + pointsDiscountAmount, 0, MidpointRounding.AwayFromZero);
                var finalAmount = AirlineClassCouponCalculator.CalculateFinalFare(baseFare, (int)discountAmount);

                // Calculate points earned: Points = (Total Passenger Fare × Percentage) / 100
                // Discount = Points / 10
                int pointsEarned = finalAmount <= 0 ? 0 : AirlineClassCouponCalculator.CalculatePoints(finalAmount, percentage);
                int generatedCouponAmount = AirlineClassCouponCalculator.CalculateDiscount(pointsEarned);

                // Create Booking
                var booking = new Booking
                {
                    BookingReference = bookingReference,
                    IdempotencyKey = dto.IdempotencyKey,
                    UserId = userId,
                    FlightId = flight.FlightId,
                    PassengerName = dto.PassengerName.Trim(),
                    PassengerEmail = dto.PassengerEmail.Trim(),
                    PassengerPhone = dto.PassengerPhone.Trim(),
                    PassengerAge = dto.PassengerAge,
                    PassengerGender = dto.PassengerGender,
                    SeatNumber = dto.SeatNumber.Trim().ToUpper(),
                    Class = dto.Class,
                    PassengerCount = dto.PassengerCount,
                    BookingDate = DateTime.UtcNow,
                    FlightJourneyDate = flight.DepartureDate,
                    DistanceKm = distanceKm,
                    BaseFare = baseFare,
                    Taxes = taxes,
                    TicketPrice = finalAmount,
                    DiscountAmount = discountAmount,
                    BookingStatus = BookingStatuses.Confirmed,
                    PaymentStatus = "Paid" // Simulated payment flow success
                };

                _context.Bookings.Add(booking);
                await _context.SaveChangesAsync();

                Coupon? generatedCoupon = null;
                var today = _couponService.GetBusinessDate();
                var initialCouponStatus = flight.DepartureDate <= today ? "Available" : "Pending";
                if (booking.BookingStatus == "Confirmed" &&
                    booking.PaymentStatus == "Paid")
                {
                    var now = DateTime.UtcNow;
                    var journeyDate = flight.DepartureDate;
                    var generatedCouponCode = await GenerateUniqueCouponCodeAsync();
                    generatedCoupon = new Coupon
                    {
                        CouponCode = generatedCouponCode,                        
                        DiscountType = "Fixed",
                        DiscountValue = generatedCouponAmount,
                        OriginalFlightFare = baseFare,
                        CouponPoints = pointsEarned,
                        DiscountPercentage = percentage,
                        DiscountAmount = generatedCouponAmount,
                        MinimumAmount = 0m,
                        MaximumDiscount = generatedCouponAmount,
                        ExpiryDate = now.AddYears(1),
                        TotalUsageLimit = 1,
                        UsedCount = 0,
                        Status = initialCouponStatus,
                        CreatedAt = now,
                        UserId = userId,
                        GeneratedForBookingId = booking.BookingId,
                        JourneyDate = journeyDate,
                        AvailableFromDate = journeyDate,
                        Description = $"{flight.Airline} {dto.Class} Reward: {pointsEarned} pts ({percentage}%) - ₹{generatedCouponAmount} OFF"
                    };
                    _context.Coupons.Add(generatedCoupon);
                }

                if (pointsRedeemed > 0m)
                {
                    _context.CouponTransactions.Add(new CouponTransaction
                    {
                        UserId = userId,
                        BookingId = booking.BookingId,
                        TransactionType = "Redeemed",
                        Points = pointsRedeemed,
                        DiscountAmount = pointsDiscountAmount,
                        Status = "Redeemed",
                        TransactionDate = DateTime.UtcNow
                    });
                }

                if (pointsEarned > 0m)
                {
                    var earnedTxStatus = generatedCoupon?.Status ?? initialCouponStatus;
                    _context.CouponTransactions.Add(new CouponTransaction
                    {
                        UserId = userId,
                        BookingId = booking.BookingId,
                        TransactionType = "Earned",
                        Points = pointsEarned,
                        DiscountAmount = 0m,
                        Status = earnedTxStatus,
                        TransactionDate = booking.BookingDate
                    });
                }

                // 6. Update Flight Available Seats
                flight.AvailableSeats -= dto.PassengerCount;
                _context.Flights.Update(flight);

                // 7. Record Coupon Usage if coupon was applied
                if (appliedCoupon != null)
                {
                    var businessDate = _couponService.GetBusinessDate();
                    var couponClaimed = await _context.Coupons
                        .Where(c => c.CouponId == appliedCoupon.CouponId &&
                                    c.UserId == userId &&
                                    c.Status == "Available" &&
                                    c.UsedCount == 0 &&
                                    c.ExpiryDate > DateTime.UtcNow &&
                                    c.GeneratedForBooking != null &&
                                    c.GeneratedForBooking.Flight != null &&
                                    c.GeneratedForBooking.Flight.DepartureDate <= businessDate &&
                                    !c.CouponUsages.Any())
                        .ExecuteUpdateAsync(updates => updates
                            .SetProperty(c => c.UsedCount, c => c.UsedCount + 1)
                            .SetProperty(c => c.Status, "Used"));

                    if (couponClaimed != 1)
                    {
                        await transaction.RollbackAsync();
                        return (false, "This coupon is no longer available. Refresh your coupons and try again.", null);
                    }

                    var couponUsage = new CouponUsage
                    {
                        CouponId = appliedCoupon.CouponId,
                        UserId = userId,
                        BookingId = booking.BookingId,
                        DiscountAmount = couponDiscountAmount,
                        UsedAt = DateTime.UtcNow
                    };

                    _context.CouponUsages.Add(couponUsage);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                var detailDto = new BookingDetailDto
                {
                    BookingId = booking.BookingId,
                    BookingReference = booking.BookingReference,
                    UserId = booking.UserId,
                    FlightId = flight.FlightId,
                    PassengerName = booking.PassengerName,
                    PassengerEmail = booking.PassengerEmail,
                    PassengerPhone = booking.PassengerPhone,
                    PassengerAge = booking.PassengerAge,
                    PassengerGender = booking.PassengerGender,
                    SeatNumber = booking.SeatNumber,
                    Class = booking.Class,
                    PassengerCount = booking.PassengerCount,
                    BookingDate = booking.BookingDate,
                    FlightJourneyDate = booking.FlightJourneyDate,
                    DistanceKm = booking.DistanceKm,
                    BaseFare = baseFare,
                    DiscountAmount = discountAmount,
                    PointsRedeemed = pointsRedeemed,
                    PointsDiscountAmount = pointsDiscountAmount,
                    CouponPointsEarned = pointsEarned,
                    AvailableCouponPoints = availableCouponPoints - pointsRedeemed + (initialCouponStatus == "Available" ? pointsEarned : 0m),
                    Taxes = taxes,
                    FinalAmount = finalAmount,
                    BookingStatus = booking.BookingStatus,
                    PaymentStatus = booking.PaymentStatus,
                    FlightNumber = flight.FlightNumber,
                    Airline = flight.Airline,
                    FromCity = flight.FromCity,
                    ToCity = flight.ToCity,
                    DepartureDate = flight.DepartureDate,
                    DepartureTime = flight.DepartureTime,
                    ArrivalDate = flight.ArrivalDate,
                    ArrivalTime = flight.ArrivalTime,
                    Duration = flight.Duration,
                    AppliedCouponCode = appliedCoupon?.CouponCode,
                    AppliedCouponPercentage = appliedCoupon?.DiscountPercentage,
                    AppliedCouponPoints = appliedCoupon?.CouponPoints,
                    FinalFare = finalAmount,
                    GeneratedCouponCode = generatedCoupon?.CouponCode,
                    GeneratedCouponStatus = generatedCoupon?.Status,
                    GeneratedCouponAmount = generatedCoupon?.DiscountAmount,
                    GeneratedCouponPoints = generatedCoupon?.CouponPoints,
                    GeneratedCouponPercentage = percentage,
                    GeneratedCouponAvailableFromDate = generatedCoupon?.AvailableFromDate
                };

                return (true, "Booking confirmed successfully!", detailDto);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                var duplicateRequest = await GetBookingByIdempotencyKeyAsync(userId, dto.IdempotencyKey);
                if (duplicateRequest != null)
                {
                    return (true, "Booking confirmed successfully!", MapToDetailDto(duplicateRequest));
                }

                // The attempt passed validation but could not be completed. Keep a record so it shows
                // up as a "Failed" booking (no seat is held, no coupon is generated or consumed).
                await RecordFailedBookingAsync(userId, dto, flight, distanceKm, baseFare,
                    Math.Max(0m, baseFare - couponDiscountAmount));

                return (false, $"An error occurred during booking: {ex.Message}", null);
            }
        }

        private async Task RecordFailedBookingAsync(
            int userId,
            CreateBookingDto dto,
            Flight flight,
            decimal distanceKm,
            decimal baseFare,
            decimal attemptedAmount)
        {
            try
            {
                // Drop anything left over from the rolled-back transaction before writing the record.
                _context.ChangeTracker.Clear();

                string bookingReference;
                do
                {
                    bookingReference = $"FLT-{DateTime.UtcNow.Year}-{Random.Shared.Next(100000, 999999)}";
                }
                while (await _context.Bookings.AnyAsync(b => b.BookingReference == bookingReference));

                _context.Bookings.Add(new Booking
                {
                    BookingReference = bookingReference,
                    IdempotencyKey = null, // a retry with the same key must still be able to succeed
                    UserId = userId,
                    FlightId = flight.FlightId,
                    PassengerName = dto.PassengerName.Trim(),
                    PassengerEmail = dto.PassengerEmail.Trim(),
                    PassengerPhone = dto.PassengerPhone.Trim(),
                    PassengerAge = dto.PassengerAge,
                    PassengerGender = dto.PassengerGender,
                    SeatNumber = dto.SeatNumber.Trim().ToUpperInvariant(),
                    Class = dto.Class,
                    PassengerCount = dto.PassengerCount,
                    BookingDate = DateTime.UtcNow,
                    FlightJourneyDate = flight.DepartureDate,
                    DistanceKm = distanceKm,
                    BaseFare = baseFare,
                    Taxes = 0m,
                    TicketPrice = attemptedAmount,
                    DiscountAmount = 0m,
                    BookingStatus = BookingStatuses.Failed,
                    PaymentStatus = "Failed"
                });
                await _context.SaveChangesAsync();
            }
            catch
            {
                // Recording the failure is best effort and must never hide the original error.
                _context.ChangeTracker.Clear();
            }
        }

        private async Task<string> GenerateUniqueCouponCodeAsync()
        {
            const int maximumAttempts = 20;
            for (var attempt = 0; attempt < maximumAttempts; attempt++)
            {
                var candidate = CouponCodeGenerator.Generate();
                var exists = await _context.Coupons.AnyAsync(coupon =>
                    coupon.CouponCode == candidate ||
                    coupon.LegacyCouponCode == candidate);
                if (!exists)
                {
                    return candidate;
                }
            }

            throw new InvalidOperationException(
                $"Unable to generate a unique {CouponCodeGenerator.CodeLength}-character coupon code after {maximumAttempts} attempts.");
        }

        private Task<Booking?> GetBookingByIdempotencyKeyAsync(int userId, Guid idempotencyKey)
        {
            return _context.Bookings
                .AsNoTracking()
                .Include(booking => booking.Flight)
                .Include(booking => booking.CouponUsages)
                    .ThenInclude(usage => usage.Coupon)
                .Include(booking => booking.CouponTransactions)
                .Include(booking => booking.GeneratedCoupon)
                .FirstOrDefaultAsync(booking =>
                    booking.UserId == userId &&
                    booking.IdempotencyKey == idempotencyKey);
        }

        public async Task<IEnumerable<BookingDetailDto>> GetUserBookingsAsync(int userId)
        {
            var bookings = await _context.Bookings
                .Include(b => b.Flight)
                .Include(b => b.CouponUsages)
                    .ThenInclude(cu => cu.Coupon)
                .Include(b => b.CouponTransactions)
                .Include(b => b.GeneratedCoupon)
                .Where(b => b.UserId == userId)
                .OrderByDescending(b => b.BookingDate)
                .ToListAsync();

            return bookings.Select(MapToDetailDto);
        }

        public async Task<BookingDetailDto?> GetBookingByIdAsync(int bookingId, int userId)
        {
            var booking = await _context.Bookings
                .Include(b => b.Flight)
                .Include(b => b.CouponUsages)
                    .ThenInclude(cu => cu.Coupon)
                .Include(b => b.CouponTransactions)
                .Include(b => b.GeneratedCoupon)
                .FirstOrDefaultAsync(b => b.BookingId == bookingId && b.UserId == userId);

            return booking == null ? null : MapToDetailDto(booking);
        }

        public async Task<(bool Success, string Message)> CancelBookingAsync(int bookingId, int userId, bool isAdmin = false)
        {
            using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            var booking = await _context.Bookings
                .Include(b => b.Flight)
                .FirstOrDefaultAsync(b => b.BookingId == bookingId && (b.UserId == userId || isAdmin));

            if (booking == null)
            {
                await transaction.RollbackAsync();
                return (false, "Booking not found.");
            }

            if (string.Equals(booking.BookingStatus, BookingStatuses.Cancelled, StringComparison.OrdinalIgnoreCase))
            {
                await transaction.RollbackAsync();
                return (false, "Booking is already cancelled.");
            }

            if (string.Equals(booking.BookingStatus, BookingStatuses.Failed, StringComparison.OrdinalIgnoreCase))
            {
                await transaction.RollbackAsync();
                return (false, "A failed booking cannot be cancelled.");
            }

            // Update Booking Status to Cancelled in the database
            booking.BookingStatus = BookingStatuses.Cancelled;
            booking.PaymentStatus = "Refunded";
            booking.CancelDate = DateTime.UtcNow;

            // Restore available seats on flight based on passenger count
            if (booking.Flight != null)
            {
                booking.Flight.AvailableSeats = Math.Min(
                    booking.Flight.TotalSeats,
                    booking.Flight.AvailableSeats + Math.Max(1, booking.PassengerCount));
            }

            // Permanently delete or cancel all coupons newly generated for this cancelled ticket
            var earnedCoupons = await _context.Coupons
                .Include(c => c.CouponUsages)
                .Where(c => c.GeneratedForBookingId == booking.BookingId)
                .ToListAsync();

            booking.GeneratedCoupon = null;

            foreach (var earnedCoupon in earnedCoupons)
            {
                if (earnedCoupon.CouponUsages.Any())
                {
                    _context.CouponUsages.RemoveRange(earnedCoupon.CouponUsages);
                }
                _context.Coupons.Remove(earnedCoupon);
            }

            // Coupons used for the cancelled ticket must not remain in Used status; they must be changed back to Available
            var appliedUsages = await _context.CouponUsages
                .Include(u => u.Coupon)
                .Where(u => u.BookingId == booking.BookingId)
                .ToListAsync();

            foreach (var appliedUsage in appliedUsages)
            {
                if (appliedUsage.Coupon != null)
                {
                    appliedUsage.Coupon.UsedCount = Math.Max(0, appliedUsage.Coupon.UsedCount - 1);
                    appliedUsage.Coupon.Status = "Available";
                }
                _context.CouponUsages.Remove(appliedUsage);
            }

            // Mark any points earned from this booking as Cancelled
            var earnedTransactions = await _context.CouponTransactions
                .Where(couponTransaction =>
                    couponTransaction.BookingId == bookingId &&
                    couponTransaction.UserId == booking.UserId &&
                    couponTransaction.TransactionType == "Earned" &&
                    couponTransaction.Status != "Cancelled")
                .ToListAsync();
            foreach (var t in earnedTransactions)
            {
                t.Status = "Cancelled";
            }

            // If user redeemed points directly for this booking, refund those points back
            var redeemedTransactions = await _context.CouponTransactions
                .Where(couponTransaction =>
                    couponTransaction.BookingId == bookingId &&
                    couponTransaction.UserId == booking.UserId &&
                    couponTransaction.TransactionType == "Redeemed" &&
                    couponTransaction.Status == "Redeemed")
                .ToListAsync();
            foreach (var t in redeemedTransactions)
            {
                t.Status = "Cancelled";
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return (true, "Ticket cancelled successfully. Booking status updated to Cancelled.");
        }

        public async Task<(bool Success, string Message, BookingDetailDto? Booking)> RescheduleBookingAsync(
            int bookingId, int userId, RescheduleBookingDto dto)
        {
            var seatNumber = (dto.SeatNumber ?? string.Empty).Trim().ToUpperInvariant();
            if (seatNumber.Length == 0)
            {
                return (false, "Seat number is required.", null);
            }

            var today = _couponService.GetBusinessDate();

            using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

            var booking = await _context.Bookings
                .Include(b => b.Flight)
                .FirstOrDefaultAsync(b => b.BookingId == bookingId && b.UserId == userId);

            if (booking == null)
            {
                await transaction.RollbackAsync();
                return (false, "Booking not found.", null);
            }

            if (booking.BookingStatus != BookingStatuses.Confirmed &&
                booking.BookingStatus != BookingStatuses.Rescheduled)
            {
                await transaction.RollbackAsync();
                var reason = booking.BookingStatus switch
                {
                    BookingStatuses.Cancelled => "A cancelled booking cannot be rescheduled.",
                    BookingStatuses.Failed => "A failed booking cannot be rescheduled.",
                    _ => "Only confirmed bookings can be rescheduled."
                };
                return (false, reason, null);
            }

            var currentFlight = booking.Flight;
            if (currentFlight == null)
            {
                await transaction.RollbackAsync();
                return (false, "The current flight for this booking could not be found.", null);
            }

            if (currentFlight.DepartureDate < today)
            {
                await transaction.RollbackAsync();
                return (false, "This flight has already departed and cannot be rescheduled.", null);
            }

            var newFlight = await _context.Flights.FirstOrDefaultAsync(f => f.FlightId == dto.NewFlightId);
            if (newFlight == null)
            {
                await transaction.RollbackAsync();
                return (false, "The selected flight was not found.", null);
            }

            if (newFlight.FlightId == currentFlight.FlightId)
            {
                await transaction.RollbackAsync();
                return (false, "Choose a different flight to reschedule to.", null);
            }

            if (!string.Equals(newFlight.FromCity, currentFlight.FromCity, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(newFlight.ToCity, currentFlight.ToCity, StringComparison.OrdinalIgnoreCase))
            {
                await transaction.RollbackAsync();
                return (false, "You can only reschedule to another flight on the same route.", null);
            }

            if (!string.Equals(newFlight.Status, "Scheduled", StringComparison.OrdinalIgnoreCase) ||
                newFlight.DepartureDate < today)
            {
                await transaction.RollbackAsync();
                return (false, "The selected flight is not open for booking.", null);
            }

            if (newFlight.AvailableSeats <= 0)
            {
                await transaction.RollbackAsync();
                return (false, "No available seats on the selected flight.", null);
            }

            var seatTaken = await _context.Bookings.AnyAsync(b =>
                b.FlightId == newFlight.FlightId &&
                b.SeatNumber == seatNumber &&
                b.BookingId != booking.BookingId &&
                b.BookingStatus != BookingStatuses.Cancelled &&
                b.BookingStatus != BookingStatuses.Failed);
            if (seatTaken)
            {
                await transaction.RollbackAsync();
                return (false, "This seat has already been booked for the selected flight.", null);
            }

            // Move the seat from the old flight to the new one. The fare is unchanged because the route is the same.
            currentFlight.AvailableSeats += booking.PassengerCount;
            newFlight.AvailableSeats -= booking.PassengerCount;

            booking.Flight = newFlight;
            booking.FlightId = newFlight.FlightId;
            booking.FlightJourneyDate = newFlight.DepartureDate;
            booking.SeatNumber = seatNumber;
            booking.BookingStatus = BookingStatuses.Rescheduled;

            // The reward coupon unlocks on the journey date, so keep it in step with the new flight date.
            var rewardCoupon = await _context.Coupons
                .FirstOrDefaultAsync(c => c.GeneratedForBookingId == booking.BookingId);
            if (rewardCoupon != null && rewardCoupon.UsedCount == 0 &&
                (rewardCoupon.Status == "Pending" || rewardCoupon.Status == "Available"))
            {
                rewardCoupon.JourneyDate = newFlight.DepartureDate;
                rewardCoupon.AvailableFromDate = newFlight.DepartureDate;
                if (rewardCoupon.Status == "Available" && newFlight.DepartureDate > today)
                {
                    rewardCoupon.Status = "Pending";
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var updated = await GetBookingByIdAsync(bookingId, userId);
            return (true, "Booking rescheduled successfully.", updated);
        }

        private static BookingDetailDto MapToDetailDto(Booking b)
        {
            var couponUsage = b.CouponUsages.FirstOrDefault();
            decimal couponDiscount = couponUsage?.DiscountAmount ?? 0m;
            decimal pointsDiscount = b.CouponTransactions
                .Where(transaction => transaction.TransactionType == "Redeemed")
                .Sum(transaction => transaction.DiscountAmount);
            decimal calculatedDiscount = couponDiscount + pointsDiscount;
            decimal discount = b.DiscountAmount > 0m || calculatedDiscount == 0m
                ? b.DiscountAmount
                : calculatedDiscount;
            decimal final = b.TicketPrice;
            var distanceKm = b.DistanceKm ?? b.Flight?.DistanceKm;
            var economyFare = b.Flight != null && b.Flight.Price > 0m
                ? b.Flight.Price
                : FlightFareCalculator.ResolveBaseFare(distanceKm);
            var calculatedFare = economyFare > 0m
                ? FlightFareCalculator.CalculateClassFare(economyFare, b.Class)
                : final;
            var baseFare = b.BaseFare ?? calculatedFare;
            var taxes = b.Taxes ?? 0m;

            return new BookingDetailDto
            {
                BookingId = b.BookingId,
                BookingReference = b.BookingReference,
                UserId = b.UserId,
                FlightId = b.FlightId,
                PassengerName = b.PassengerName,
                PassengerEmail = b.PassengerEmail,
                PassengerPhone = b.PassengerPhone,
                PassengerAge = b.PassengerAge,
                PassengerGender = b.PassengerGender,
                SeatNumber = b.SeatNumber,
                Class = b.Class,
                PassengerCount = b.PassengerCount < 1 ? 1 : b.PassengerCount,
                BookingDate = b.BookingDate,
                FlightJourneyDate = b.FlightJourneyDate ?? b.Flight?.DepartureDate,
                DistanceKm = distanceKm,
                BaseFare = baseFare,
                DiscountAmount = discount,
                Taxes = taxes,
                FinalAmount = final,
                PointsRedeemed = b.CouponTransactions
                    .Where(transaction => transaction.TransactionType == "Redeemed")
                    .Sum(transaction => transaction.Points),
                PointsDiscountAmount = b.CouponTransactions
                    .Where(transaction => transaction.TransactionType == "Redeemed")
                    .Sum(transaction => transaction.DiscountAmount),
                CouponPointsEarned = b.CouponTransactions
                    .Where(transaction => transaction.TransactionType == "Earned" && transaction.Status != "Cancelled")
                    .Sum(transaction => transaction.Points),
                BookingStatus = b.BookingStatus,
                PaymentStatus = b.PaymentStatus,
                CancelDate = b.CancelDate,
                FlightNumber = b.Flight?.FlightNumber ?? "N/A",
                Airline = b.Flight?.Airline ?? "N/A",
                FromCity = b.Flight?.FromCity ?? "N/A",
                ToCity = b.Flight?.ToCity ?? "N/A",
                DepartureDate = b.Flight?.DepartureDate ?? DateOnly.MinValue,
                DepartureTime = b.Flight?.DepartureTime ?? "N/A",
                ArrivalDate = b.Flight?.ArrivalDate ?? DateOnly.MinValue,
                ArrivalTime = b.Flight?.ArrivalTime ?? "N/A",
                Duration = b.Flight?.Duration ?? "N/A",
                AppliedCouponCode = couponUsage?.Coupon?.CouponCode,
                AppliedCouponPercentage = couponUsage?.Coupon?.DiscountPercentage,
                AppliedCouponPoints = couponUsage?.Coupon?.CouponPoints,
                FinalFare = final,
                GeneratedCouponCode = b.GeneratedCoupon?.CouponCode,
                GeneratedCouponStatus = b.GeneratedCoupon?.Status,
                GeneratedCouponAmount = b.GeneratedCoupon?.DiscountAmount,
                GeneratedCouponPoints = b.GeneratedCoupon?.CouponPoints,
                GeneratedCouponPercentage = b.GeneratedCoupon?.DiscountPercentage,
                GeneratedCouponAvailableFromDate = b.GeneratedCoupon?.AvailableFromDate
            };
        }
    }
}

