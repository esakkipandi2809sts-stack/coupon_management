using FlightBookingBackend.Services;
using Xunit;

namespace FlightBookingBackend.Tests;

public class RouteDistanceCalculatorTests
{
    [Fact]
    public void SupportedCitiesProduceAPositiveRouteDistance()
    {
        var distance = RouteDistanceCalculator.TryCalculate("Chennai", "Bengaluru");

        Assert.NotNull(distance);
        Assert.InRange(distance!.Value, 300m, 340m);
    }

    [Fact]
    public void CityLookupIgnoresCaseSpacingAndAliases()
    {
        var canonical = RouteDistanceCalculator.TryCalculate("Chennai", "Bengaluru");
        var aliased = RouteDistanceCalculator.TryCalculate("  CHENNAI ", "bangalore");

        Assert.Equal(canonical, aliased);
    }

    [Fact]
    public void DistanceIsTheSameInBothDirections()
    {
        Assert.Equal(
            RouteDistanceCalculator.TryCalculate("Delhi", "Mumbai"),
            RouteDistanceCalculator.TryCalculate("Mumbai", "Delhi"));
    }

    [Theory]
    [InlineData("Chennai", "Atlantis")]
    [InlineData("Atlantis", "Chennai")]
    [InlineData("", "Chennai")]
    [InlineData("Chennai", null)]
    public void UnknownOrMissingCitiesDoNotInventADistance(string? from, string? to)
    {
        Assert.Null(RouteDistanceCalculator.TryCalculate(from, to));
    }
}
