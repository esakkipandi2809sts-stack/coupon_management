
using FlightBookingBackend.Data;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Services;

public class CouponCalculationService
{
    private readonly FlightBookingDbContext _context;

    public CouponCalculationService(FlightBookingDbContext context)
    {
        _context = context;
    }

    public async Task<decimal> GetPercentageAsync(
        string airlineName,
        string cabinClass)
    {
        if (string.IsNullOrWhiteSpace(airlineName))
            throw new ArgumentException("Airline name is required.");

        if (string.IsNullOrWhiteSpace(cabinClass))
            throw new ArgumentException("Cabin class is required.");

        var airline = airlineName.Trim().ToLower();
        var cabin = cabinClass.Trim().ToLower();

        var rule = await _context.CouponPercentageRules
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.IsActive &&
                x.AirlineName.ToLower() == airline &&
                x.CabinClass.ToLower() == cabin);

        if (rule == null)
        {
            throw new InvalidOperationException(
                $"No active coupon rule found for {airlineName} - {cabinClass}.");
        }

        return rule.Percentage;
    }

    public async Task<CouponCalculationResult> CalculateAsync(
        decimal bookingFare,
        string airlineName,
        string cabinClass)
    {
        if (bookingFare <= 0)
        {
            throw new ArgumentException(
                "Booking fare must be greater than zero.");
        }

        var percentage = await GetPercentageAsync(
            airlineName,
            cabinClass);

        var points = Math.Round(
            bookingFare * percentage / 100m,
            2,
            MidpointRounding.AwayFromZero);

        var discountAmount = Math.Round(
            points / 10m,
            2,
            MidpointRounding.AwayFromZero);

        return new CouponCalculationResult
        {
            AirlineName = airlineName.Trim(),
            CabinClass = cabinClass.Trim(),
            BookingFare = bookingFare,
            Percentage = percentage,
            Points = points,
            DiscountAmount = discountAmount
        };
    }
}

public class CouponCalculationResult
{
    public string AirlineName { get; set; } = string.Empty;
    public string CabinClass { get; set; } = string.Empty;
    public decimal BookingFare { get; set; }
    public decimal Percentage { get; set; }
    public decimal Points { get; set; }
    public decimal DiscountAmount { get; set; }
}
