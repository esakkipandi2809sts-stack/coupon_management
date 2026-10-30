using FlightBookingBackend.Services;
using Xunit;

namespace FlightBookingBackend.Tests;

public class FlightFareCalculatorTests
{
    [Theory]
    [InlineData(100, 1500)]
    [InlineData(200, 1500)]
    [InlineData(500, 2000)]
    [InlineData(1000, 4000)]
    [InlineData(1760, 7040)]
    [InlineData(2000, 8000)]
    public void EconomyFareUsesFourRupeesPerKilometerWithMinimumFare(decimal distanceKm, decimal expectedFare)
    {
        Assert.Equal(expectedFare, FlightFareCalculator.CalculateEconomyFare(distanceKm));
    }

    [Theory]
    [InlineData(100, "Economy", 1500)]
    [InlineData(100, "Business", 2250)]
    [InlineData(100, "First", 3300)]
    [InlineData(500, "Economy", 2000)]
    [InlineData(500, "Business", 3000)]
    [InlineData(500, "First", 4400)]
    [InlineData(1760, "Economy", 7040)]
    [InlineData(1760, "Business", 10560)]
    [InlineData(1760, "First", 15488)]
    [InlineData(2000, "Economy", 8000)]
    [InlineData(2000, "Business", 12000)]
    [InlineData(2000, "First Class", 17600)]
    public void RouteDistanceAndClassProduceExpectedFare(decimal distanceKm, string flightClass, decimal expectedFare)
    {
        Assert.Equal(expectedFare, FlightFareCalculator.CalculateBaseFare(distanceKm, flightClass));
    }

    [Fact]
    public void ResolveBaseFareUsesDistanceInsteadOfAStaleStoredFare()
    {
        Assert.Equal(1500m, FlightFareCalculator.ResolveBaseFare(100m));
        Assert.Equal(2000m, FlightFareCalculator.ResolveBaseFare(500m));
        Assert.Equal(7040m, FlightFareCalculator.ResolveBaseFare(1760m));
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
