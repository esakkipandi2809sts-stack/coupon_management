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
                .Where(c => c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled)
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
                                                      (c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled));
            var totalCoupons = await coupons.CountAsync();
            var availableCoupons = await coupons.CountAsync(c => c.Status == "Available");
            var pendingCoupons = await coupons.CountAsync(c => c.Status == "Pending");
            var usedCoupons = await coupons.CountAsync(c => c.Status == "Used");
            var expiredCoupons = await coupons.CountAsync(c => c.Status == "Expired");

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
                .Where(c => c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled);
            return new CouponStatisticsDto
            {
                AvailableCoupons = await coupons.CountAsync(c => c.Status == "Available"),
                PendingCoupons = await coupons.CountAsync(c => c.Status == "Pending"),
                UsedCoupons = await coupons.CountAsync(c => c.Status == "Used"),
                ExpiredCoupons = await coupons.CountAsync(c => c.Status == "Expired"),
                TotalCoupons = await coupons.CountAsync()
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
                TotalPoints = available + pending + redeemed,
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

            if (coupon.GeneratedForBooking?.Flight == null ||
                coupon.GeneratedForBooking.Flight.DepartureDate > GetBusinessDate())
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
                BookingStatus = c.GeneratedForBooking?.BookingStatus,
                AvailableFromDate = scheduledDepartureDate ?? c.AvailableFromDate
            };
        }
    }
}
