using FlightBookingBackend.Services;
using Xunit;

namespace FlightBookingBackend.Tests;

public class FlightFareCalculatorTests
{
    [Theory]
    [InlineData(100, 1500)]
    [InlineData(200, 2000)]
    [InlineData(500, 5000)]
    [InlineData(1000, 10000)]
    [InlineData(2000, 20000)]
    public void EconomyFareUsesTenRupeesPerKilometerWithMinimumFare(decimal distanceKm, decimal expectedFare)
    {
        Assert.Equal(expectedFare, FlightFareCalculator.CalculateEconomyFare(distanceKm));
    }

    [Theory]
    [InlineData(100, "Economy", 1500)]
    [InlineData(100, "Business", 2250)]
    [InlineData(100, "First", 3300)]
    [InlineData(500, "Economy", 5000)]
    [InlineData(500, "Business", 7500)]
    [InlineData(500, "First", 11000)]
    [InlineData(2000, "Economy", 20000)]
    [InlineData(2000, "Business", 30000)]
    [InlineData(2000, "First Class", 44000)]
    public void RouteDistanceAndClassProduceExpectedFare(decimal distanceKm, string flightClass, decimal expectedFare)
    {
        Assert.Equal(expectedFare, FlightFareCalculator.CalculateBaseFare(distanceKm, flightClass));
    }

    [Fact]
    public void ResolveBaseFareUsesDistanceInsteadOfAStaleStoredFare()
    {
        Assert.Equal(1500m, FlightFareCalculator.ResolveBaseFare(100m));
        Assert.Equal(2000m, FlightFareCalculator.ResolveBaseFare(200m));
    }

    [Fact]
    public void ResolveBaseFareDoesNotInventAFareWhenDistanceIsMissingOrInvalid()
    {
        Assert.Equal(0m, FlightFareCalculator.ResolveBaseFare(0m));
        Assert.Equal(0m, FlightFareCalculator.ResolveBaseFare(null));
    }

    [Fact]
    public void InvalidClassAndDistanceAreRejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => FlightFareCalculator.CalculateBaseFare(0m, "Economy"));
        Assert.Throws<ArgumentException>(() => FlightFareCalculator.CalculateBaseFare(100m, "Premium"));
    }
}
