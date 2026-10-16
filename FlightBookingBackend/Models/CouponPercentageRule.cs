
namespace FlightBookingBackend.Models;

public class CouponPercentageRule
{
    public int Id { get; set; }

    public string AirlineName { get; set; } = string.Empty;

    public string CabinClass { get; set; } = string.Empty;

    public decimal Percentage { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
