using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Services
{
    public class CouponService : ICouponService
    {
        private const int RequiredSuccessfulBookings = 1;
        private readonly FlightBookingDbContext _context;
        private readonly TimeProvider _timeProvider;
        private readonly TimeZoneInfo _businessTimeZone;

        public CouponService(
            FlightBookingDbContext context,
            IConfiguration? configuration = null,
            TimeProvider? timeProvider = null)
        {
            _context = context;
            _timeProvider = timeProvider ?? TimeProvider.System;
            _businessTimeZone = CouponBusinessTime.ResolveTimeZone(
                configuration?["Coupons:BusinessTimeZoneId"]);
        }

        public DateOnly GetBusinessDate() =>
            CouponBusinessTime.GetDate(_timeProvider.GetUtcNow(), _businessTimeZone);

        public async Task<IEnumerable<CouponDto>> GetAllCouponsAsync(int userId)
        {
            await RefreshStatusesAsync();

            var coupons = await _context.Coupons
                .AsNoTracking()
                .Include(c => c.GeneratedForBooking)
                    .ThenInclude(b => b!.Flight)
                .Where(c => c.UserId == userId &&
                            c.Status != "Cancelled" &&
                            (c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled))
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            return coupons.Select(MapToDto);
        }

        public async Task<IEnumerable<CouponDto>> GetAllCouponsForAdminAsync()
        {
            await RefreshStatusesAsync();

            var coupons = await _context.Coupons
                .AsNoTracking()
                .Include(c => c.GeneratedForBooking)
                    .ThenInclude(b => b!.Flight)
                .Where(c => c.Status != "Cancelled" &&
                            (c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled))
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
            var ownerIds = coupons
                .Where(coupon => coupon.UserId.HasValue)
                .Select(coupon => coupon.UserId!.Value)
                .Distinct()
                .ToArray();
            var ownerNames = await _context.Users
                .AsNoTracking()
                .Where(user => ownerIds.Contains(user.Id))
                .ToDictionaryAsync(user => user.Id, user => user.Username);

            return coupons.Select(coupon =>
            {
                var dto = MapToDto(coupon);
                dto.OwnerUsername = coupon.UserId.HasValue &&
                                    ownerNames.TryGetValue(coupon.UserId.Value, out var username)
                    ? username
                    : null;
                return dto;
            });
        }

        public async Task<CouponStatisticsDto> GetCouponStatisticsAsync(int userId)
        {
            await RefreshStatusesAsync();
            var coupons = _context.Coupons.Where(c => c.UserId == userId &&
                                                      c.Status != "Cancelled" &&
                                                      (c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled));
            var availableCoupons = await coupons.CountAsync(c => c.Status == "Available");
            var pendingCoupons = await coupons.CountAsync(c => c.Status == "Pending");
            var usedCoupons = await coupons.CountAsync(c => c.Status == "Used");
            var expiredCoupons = await coupons.CountAsync(c => c.Status == "Expired" || c.Status == "Inactive");
            var totalCoupons = availableCoupons + pendingCoupons + usedCoupons + expiredCoupons;

            return new CouponStatisticsDto
            {
                AvailableCoupons = availableCoupons,
                PendingCoupons = pendingCoupons,
                UsedCoupons = usedCoupons,
                ExpiredCoupons = expiredCoupons,
                TotalCoupons = totalCoupons
            };
        }

        public async Task<CouponStatisticsDto> GetCouponStatisticsForAdminAsync()
        {
            await RefreshStatusesAsync();
            var coupons = _context.Coupons
                .AsNoTracking()
                .Where(c => c.Status != "Cancelled" &&
                            (c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled));
            var availableCoupons = await coupons.CountAsync(c => c.Status == "Available");
            var pendingCoupons = await coupons.CountAsync(c => c.Status == "Pending");
            var usedCoupons = await coupons.CountAsync(c => c.Status == "Used");
            var expiredCoupons = await coupons.CountAsync(c => c.Status == "Expired" || c.Status == "Inactive");
            var totalCoupons = availableCoupons + pendingCoupons + usedCoupons + expiredCoupons;

            return new CouponStatisticsDto
            {
                AvailableCoupons = availableCoupons,
                PendingCoupons = pendingCoupons,
                UsedCoupons = usedCoupons,
                ExpiredCoupons = expiredCoupons,
                TotalCoupons = totalCoupons
            };
        }

        public async Task<CouponEligibilityDto> GetCouponEligibilityAsync(int userId)
        {
            var successfulBookingCount = await GetSuccessfulBookingCountAsync(userId);

            return new CouponEligibilityDto
            {
                SuccessfulBookingCount = successfulBookingCount,
                IsEligible = successfulBookingCount >= RequiredSuccessfulBookings
            };
        }

        public async Task<CouponBalanceDto> GetCouponBalanceAsync(int userId)
        {
            await RefreshStatusesAsync();

            bool hasChanges = false;

            // 1. Synchronize earned transactions with their coupon's current status
            var earnedWithCoupons = await (
                from t in _context.CouponTransactions
                join c in _context.Coupons on t.BookingId equals c.GeneratedForBookingId
                where t.UserId == userId && t.TransactionType == "Earned" && t.Status != "Cancelled"
                select new { Transaction = t, CouponStatus = c.Status }
            ).ToListAsync();

            foreach (var item in earnedWithCoupons)
            {
                if (item.CouponStatus == "Pending" && item.Transaction.Status != "Pending")
                {
                    item.Transaction.Status = "Pending";
                    hasChanges = true;
                }
                else if (item.CouponStatus == "Available" && item.Transaction.Status != "Available")
                {
                    item.Transaction.Status = "Available";
                    hasChanges = true;
                }
            }

            // 2. Cancel direct redemptions for cancelled bookings
            var cancelledBookingRedeemedTx = await (
                from t in _context.CouponTransactions
                join b in _context.Bookings on t.BookingId equals b.BookingId
                where t.UserId == userId && t.TransactionType == "Redeemed" && t.Status == "Redeemed" && b.BookingStatus == BookingStatuses.Cancelled
                select t
            ).ToListAsync();

            foreach (var tx in cancelledBookingRedeemedTx)
            {
                tx.Status = "Cancelled";
                hasChanges = true;
            }

            // 3. Reconcile point-to-coupon transactions:
            // A point coupon requires valid non-cancelled bookings to fund it.
            // If all bookings prior to a point coupon's creation were cancelled, or if total redeemed exceeds earned points,
            // cancel those unused orphaned coupons and their corresponding redeemed transactions.
            var allUserTransactions = await _context.CouponTransactions
                .Where(t => t.UserId == userId)
                .ToListAsync();

            var earnedAvailable = allUserTransactions
                .Where(t => t.TransactionType == "Earned" && t.Status == "Available")
                .Sum(t => t.Points);
            var currentRedeemed = allUserTransactions
                .Where(t => t.TransactionType == "Redeemed" && t.Status == "Redeemed")
                .Sum(t => t.Points);

            var pointCoupons = await _context.Coupons
                .Where(c => c.UserId == userId && c.GeneratedForBookingId == null && c.UsedCount == 0 && c.Status != "Used" && c.Status != "Cancelled")
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            if (pointCoupons.Any())
            {
                var pointRedeemedTx = allUserTransactions
                    .Where(t => t.TransactionType == "Redeemed" && t.Status == "Redeemed" && t.BookingId == null)
                    .OrderBy(t => t.TransactionDate)
                    .ToList();

                var activeBookings = await _context.Bookings
                    .AsNoTracking()
                    .Where(b => b.UserId == userId && b.BookingStatus != BookingStatuses.Cancelled)
                    .ToListAsync();

                foreach (var coupon in pointCoupons)
                {
                    // Was there any active (non-cancelled) booking existing when this coupon was created?
                    bool fundedByActiveBooking = activeBookings.Any(b => b.BookingDate <= coupon.CreatedAt.AddSeconds(10));

                    if (!fundedByActiveBooking || currentRedeemed > earnedAvailable)
                    {
                        coupon.Status = "Cancelled";
                        hasChanges = true;

                        var matchingTx = pointRedeemedTx.FirstOrDefault(t => t.Status == "Redeemed" && Math.Abs(t.Points - coupon.CouponPoints) < 0.01m && t.TransactionDate <= coupon.CreatedAt.AddSeconds(10))
                                         ?? pointRedeemedTx.FirstOrDefault(t => t.Status == "Redeemed");
                        if (matchingTx != null)
                        {
                            matchingTx.Status = "Cancelled";
                            currentRedeemed -= matchingTx.Points;
                            hasChanges = true;
                        }
                    }
                }
            }

            if (hasChanges)
            {
                await _context.SaveChangesAsync();
            }

            var transactions = await _context.CouponTransactions
                .AsNoTracking()
                .Where(transaction => transaction.UserId == userId)
                .Select(transaction => new
                {
                    transaction.TransactionType,
                    transaction.Points,
                    transaction.Status
                })
                .ToListAsync();

            var earned = transactions
                .Where(transaction => transaction.TransactionType == "Earned" && transaction.Status == "Available")
                .Sum(transaction => transaction.Points);
            var pending = transactions
                .Where(transaction => transaction.TransactionType == "Earned" && transaction.Status == "Pending")
                .Sum(transaction => transaction.Points);
            var redeemed = transactions
                .Where(transaction => transaction.TransactionType == "Redeemed" && transaction.Status == "Redeemed")
                .Sum(transaction => transaction.Points);
            var available = Math.Max(0m, earned - redeemed);

            return new CouponBalanceDto
            {
                AvailablePoints = available,
                PendingPoints = pending,
                RedeemedPoints = redeemed,
                TotalPoints = earned + pending,
                AvailableDiscountAmount = Math.Floor(available / 10m)
            };
        }

        public async Task<CouponValidationResultDto> ValidateCouponAsync(string couponCode, int flightId, string flightClass, int userId, int passengerCount = 1)
        {
            if (!FlightFareCalculator.IsSupportedClass(flightClass))
            {
                return new CouponValidationResultDto
                {
                    CouponCode = couponCode,
                    Message = "Travel class must be All, Economy, Premium Economy, Business, or First Class."
                };
            }

            if (string.IsNullOrWhiteSpace(couponCode))
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    Message = "Please provide a coupon code."
                };
            }

            await RefreshStatusesAsync();

            var flight = await _context.Flights.AsNoTracking().FirstOrDefaultAsync(f => f.FlightId == flightId);
            if (flight == null)
            {
                return new CouponValidationResultDto
                {
                    CouponCode = couponCode,
                    Message = "Flight not found."
                };
            }

            var baseFare = flight.Price > 0m
                ? flight.Price
                : FlightFareCalculator.ResolveBaseFare(flight.DistanceKm);
            if (baseFare <= 0m)
            {
                return new CouponValidationResultDto
                {
                    CouponCode = couponCode,
                    Message = "A valid fare is not configured for this flight."
                };
            }

            var ticketPricePerPassenger = FlightFareCalculator.CalculateClassFare(baseFare, flightClass);
            var ticketPrice = Math.Round(ticketPricePerPassenger * Math.Clamp(passengerCount, 1, 27), 0, MidpointRounding.AwayFromZero);
            var normalizedCode = couponCode.Trim().ToUpperInvariant();
            var coupon = await _context.Coupons
                .AsNoTracking()
                .Include(c => c.GeneratedForBooking)
                    .ThenInclude(b => b!.Flight)
                .FirstOrDefaultAsync(c =>
                    c.CouponCode == normalizedCode ||
                    c.LegacyCouponCode == normalizedCode);

            if (coupon == null)
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = couponCode,
                    Message = "Invalid coupon code."
                };
            }

            if (coupon.UserId != userId)
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = coupon.CouponCode,
                    Message = "This coupon does not belong to this passenger."
                };
            }

            // Enforce the flight-date restriction only for booking-linked coupons.
            // Points-converted coupons have no linked booking (GeneratedForBooking == null)
            // and must be allowed through regardless of any flight date.
            if (coupon.GeneratedForBooking != null &&
                (coupon.GeneratedForBooking.Flight == null ||
                 coupon.GeneratedForBooking.Flight.DepartureDate > GetBusinessDate()))
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = coupon.CouponCode,
                    Message = "This coupon is not available before its scheduled flight date."
                };
            }

            if (!string.Equals(coupon.Status, "Available", StringComparison.OrdinalIgnoreCase))
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = coupon.CouponCode,
                    Message = $"This coupon is currently {coupon.Status.ToLower()}."
                };
            }

            if (coupon.ExpiryDate <= _timeProvider.GetUtcNow().UtcDateTime)
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = coupon.CouponCode,
                    Message = "This coupon has expired."
                };
            }

            if (coupon.UsedCount >= coupon.TotalUsageLimit)
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = coupon.CouponCode,
                    Message = "Coupon usage limit has been reached."
                };
            }

            if (ticketPrice < coupon.MinimumAmount)
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = coupon.CouponCode,
                    Message = $"Minimum booking amount for this coupon is ₹{Math.Round(coupon.MinimumAmount, 0, MidpointRounding.AwayFromZero)}."
                };
            }

            // Check if user has already used this coupon
            var alreadyUsed = await _context.CouponUsages.AnyAsync(cu =>
                cu.CouponId == coupon.CouponId && cu.UserId == userId);
            if (alreadyUsed)
            {
                return new CouponValidationResultDto
                {
                    IsValid = false,
                    CouponCode = coupon.CouponCode,
                    Message = "You have already used this coupon code on an earlier booking."
                };
            }

            // Calculate percentage based on coupon's percentage or airline & traveller class
            decimal percentage = coupon.DiscountPercentage > 0m
                ? coupon.DiscountPercentage
                : AirlineClassCouponCalculator.GetPercentage(flight.Airline, flightClass);

            decimal points = coupon.CouponPoints > 0m
                ? coupon.CouponPoints
                : AirlineClassCouponCalculator.CalculatePoints(ticketPrice, percentage);

            decimal discountAmount;
            if (coupon.DiscountAmount > 0m)
            {
                discountAmount = Math.Min(coupon.DiscountAmount, ticketPrice);
            }
            else
            {
                discountAmount = Math.Min(AirlineClassCouponCalculator.CalculateDiscount((int)points), ticketPrice);
            }

            // All flight fares, passenger totals, coupon discounts, and final payable amounts must be integers.
            discountAmount = Math.Round(discountAmount, 0, MidpointRounding.AwayFromZero);
            points = Math.Round(points, 0, MidpointRounding.AwayFromZero);
            decimal finalPrice = AirlineClassCouponCalculator.CalculateFinalFare((int)ticketPrice, (int)discountAmount);

            return new CouponValidationResultDto
            {
                IsValid = true,
                CouponCode = coupon.CouponCode,
                Description = coupon.Description,
                DiscountType = coupon.DiscountType,
                DiscountValue = discountAmount,
                DiscountAmount = discountAmount,
                CouponPoints = points,
                DiscountPercentage = percentage,
                FinalPrice = finalPrice,
                Message = $"Coupon applied successfully! You saved ₹{discountAmount}."
            };
        }

        public async Task<(bool Success, string Message, CreateCouponFromPointsResultDto? Result)> CreateCouponFromPointsAsync(int userId, int points)
        {
            if (points < 10)
                return (false, "Minimum 10 points are required to create a coupon (10 points = ₹1).", null);

            // Read current available balance (only earned points from Available coupons minus redeemed)
            var balanceDto = await GetCouponBalanceAsync(userId);
            var available = balanceDto.AvailablePoints;

            if (available < 10)
                return (false, $"Insufficient coupon points. You currently have {Math.Floor(available)} available points in your account. Minimum 10 points are required to create a coupon.", null);

            if (points > available)
                return (false, $"Insufficient coupon points. You have {Math.Floor(available)} available points, but {points} points are required to create this coupon.", null);

            // 10 points = ₹1
            var discountAmount = (decimal)Math.Floor(points / 10.0);
            if (discountAmount <= 0)
                return (false, "Points are too low to generate a discount.", null);

            var now = DateTime.UtcNow;

            // Generate a unique coupon code
            const int maxAttempts = 20;
            string couponCode = string.Empty;
            for (var attempt = 0; attempt < maxAttempts; attempt++)
            {
                var candidate = CouponCodeGenerator.Generate();
                var exists = await _context.Coupons.AnyAsync(c =>
                    c.CouponCode == candidate || c.LegacyCouponCode == candidate);
                if (!exists) { couponCode = candidate; break; }
            }
            if (string.IsNullOrEmpty(couponCode))
                return (false, "Could not generate a unique coupon code. Please try again.", null);

            // Deduct points
            _context.CouponTransactions.Add(new CouponTransaction
            {
                UserId = userId,
                BookingId = null,
                TransactionType = "Redeemed",
                Points = points,
                DiscountAmount = discountAmount,
                Status = "Redeemed",
                TransactionDate = now
            });

            // Create the coupon
            var coupon = new Coupon
            {
                CouponCode = couponCode,
                Description = $"Points Redemption Coupon: {points} pts — ₹{discountAmount} OFF",
                DiscountType = "Fixed",
                DiscountValue = discountAmount,
                DiscountAmount = discountAmount,
                DiscountPercentage = 0m,
                CouponPoints = points,
                OriginalFlightFare = 0m,
                MinimumAmount = 0m,
                MaximumDiscount = discountAmount,
                ExpiryDate = now.AddYears(1),
                TotalUsageLimit = 1,
                UsedCount = 0,
                Status = "Pending",
                CreatedAt = now,
                UserId = userId,
                GeneratedForBookingId = null
            };
            _context.Coupons.Add(coupon);
            await _context.SaveChangesAsync();

            return (true, "Coupon created successfully.", new CreateCouponFromPointsResultDto
            {
                CouponCode = couponCode,
                DiscountAmount = discountAmount,
                PointsRedeemed = points,
                ExpiryDate = coupon.ExpiryDate,
                Status = coupon.Status
            });
        }

        public async Task RefreshStatusesAsync()
        {
            var today = GetBusinessDate();
            var now = _timeProvider.GetUtcNow().UtcDateTime;

            // 1. Permanently delete any coupons generated for cancelled bookings from the database
            var cancelledBookingCoupons = await _context.Coupons
                .Include(c => c.CouponUsages)
                .Where(c => c.GeneratedForBooking != null && c.GeneratedForBooking.BookingStatus == BookingStatuses.Cancelled)
                .ToListAsync();

            if (cancelledBookingCoupons.Any())
            {
                var usagesToRemove = cancelledBookingCoupons.SelectMany(c => c.CouponUsages).ToList();
                if (usagesToRemove.Any())
                {
                    _context.CouponUsages.RemoveRange(usagesToRemove);
                }
                _context.Coupons.RemoveRange(cancelledBookingCoupons);
                await _context.SaveChangesAsync();
            }

            // 2. Clean up coupon usages for cancelled bookings and restore used coupons back to Available
            var cancelledUsages = await _context.CouponUsages
                .Include(u => u.Coupon)
                .Include(u => u.Booking)
                .Where(u => u.Booking != null && u.Booking.BookingStatus == BookingStatuses.Cancelled)
                .ToListAsync();

            if (cancelledUsages.Any())
            {
                foreach (var usage in cancelledUsages)
                {
                    if (usage.Coupon != null)
                    {
                        usage.Coupon.UsedCount = Math.Max(0, usage.Coupon.UsedCount - 1);
                        if (usage.Coupon.UsedCount < usage.Coupon.TotalUsageLimit && usage.Coupon.ExpiryDate > now)
                        {
                            usage.Coupon.Status = "Available";
                        }
                    }
                }
                _context.CouponUsages.RemoveRange(cancelledUsages);
                await _context.SaveChangesAsync();
            }

            // 3. Update status of coupons used by active bookings
            await _context.Coupons
                .Where(c => c.Status != "Used" &&
                            (c.UsedCount >= c.TotalUsageLimit || c.CouponUsages.Any(u => u.Booking != null && u.Booking.BookingStatus != BookingStatuses.Cancelled)))
                .ExecuteUpdateAsync(updates => updates.SetProperty(c => c.Status, "Used"));

            // 5. Update expired
            await _context.Coupons
                .Where(c => c.Status == "Inactive")
                .ExecuteUpdateAsync(updates => updates.SetProperty(c => c.Status, "Expired"));

            await _context.Coupons
                .Where(c => (c.Status == "Pending" || c.Status == "Available") &&
                            c.ExpiryDate <= now)
                .ExecuteUpdateAsync(updates => updates.SetProperty(c => c.Status, "Expired"));

            // 6. Update pending to available
            await _context.Coupons
                .Where(c => c.Status == "Pending" &&
                            c.GeneratedForBooking != null &&
                            c.GeneratedForBooking.Flight != null &&
                            c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled &&
                            c.GeneratedForBooking.Flight.DepartureDate <= today &&
                            c.ExpiryDate > now)
                .ExecuteUpdateAsync(updates => updates.SetProperty(c => c.Status, "Available"));

            // 7. Update pending coupon transactions to available
            await _context.CouponTransactions
                .Where(t => t.TransactionType == "Earned" &&
                            t.Status == "Pending" &&
                            t.Booking != null &&
                            t.Booking.Flight != null &&
                            t.Booking.BookingStatus != BookingStatuses.Cancelled &&
                            t.Booking.Flight.DepartureDate <= today)
                .ExecuteUpdateAsync(updates => updates.SetProperty(t => t.Status, "Available"));
        }

        private Task<int> GetSuccessfulBookingCountAsync(int userId)
        {
            return _context.Bookings.CountAsync(booking =>
                booking.UserId == userId &&
                (booking.BookingStatus == "Confirmed" || booking.BookingStatus == "Rescheduled") &&
                booking.PaymentStatus == "Paid");
        }

        private static CouponDto MapToDto(Coupon c)
        {
            var scheduledDepartureDate = c.GeneratedForBooking?.Flight?.DepartureDate;
            return new CouponDto
            {
                CouponId = c.CouponId,
                UserId = c.UserId,
                CouponCode = c.LegacyCouponCode ?? c.CouponCode,
                Description = c.Description,
                DiscountType = c.DiscountType,
                DiscountValue = c.DiscountValue,
                OriginalFlightFare = c.OriginalFlightFare,
                DiscountPercentage = c.DiscountPercentage,
                DiscountAmount = c.DiscountAmount,
                CouponPoints = c.CouponPoints,
                MinimumAmount = c.MinimumAmount,
                MaximumDiscount = c.MaximumDiscount,
                ExpiryDate = c.ExpiryDate,
                TotalUsageLimit = c.TotalUsageLimit,
                UsedCount = c.UsedCount,
                Status = c.Status,
                CreatedAt = c.CreatedAt,
                JourneyDate = scheduledDepartureDate ?? c.JourneyDate,
                BookingReference = c.GeneratedForBooking?.BookingReference,
                BookingDate = c.GeneratedForBooking?.BookingDate ?? c.CreatedAt,
                BookingStatus = c.GeneratedForBooking?.BookingStatus,
                AvailableFromDate = scheduledDepartureDate ?? c.AvailableFromDate
            };
        }
    }
}
