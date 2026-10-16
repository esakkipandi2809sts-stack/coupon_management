using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlightBookingBackend.Tests;

public class FlightItineraryTests
{
    private static readonly DateOnly Day1 = new(2035, 3, 10);

    private static async Task<(SqliteConnection Connection, FlightBookingDbContext Context)> CreateContextAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<FlightBookingDbContext>().UseSqlite(connection).Options;
        var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return (connection, context);
    }

    private static CreateFlightDto Segment(
        string number, string from, string to, DateOnly depDate, string depTime, DateOnly arrDate, string arrTime) => new()
    {
        FlightNumber = number,
        Airline = "Test Airways",
        FromCity = from,
        ToCity = to,
        StopCount = 0,
        DepartureDate = depDate,
        DepartureTime = depTime,
        ArrivalDate = arrDate,
        ArrivalTime = arrTime,
        Duration = "2h",
        DistanceKm = RouteDistanceCalculator.TryCalculate(from, to) ?? 100m,
        TotalSeats = 180,
        AvailableSeats = 150,
        Status = "Scheduled"
    };

    [Fact]
    public async Task OneWayStoresSingleFlightWithUsernameOnlyAndNoItinerary()
    {
        var (connection, context) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;
        var service = new FlightService(context);

        var result = await service.CreateItineraryAsync(new CreateItineraryDto
        {
            TripType = FlightTripTypes.OneWay,
            Segments = { Segment("OW-1", "Chennai", "Delhi", Day1, "09:00", Day1, "11:30") }
        }, "admin@example.com");

        var saved = await context.Flights.SingleAsync();
        Assert.Equal(FlightTripTypes.OneWay, saved.TripType);
        Assert.Null(saved.ItineraryId);
        Assert.Null(saved.SegmentOrder);
        Assert.Equal("admin@example.com", saved.CreatedByUserName);
        Assert.Equal(saved.Price, result.TotalFare);
        Assert.Equal(FlightFareCalculator.ResolveBaseFare(saved.DistanceKm), saved.Price);
    }

    [Fact]
    public async Task RoundTripStoresTwoSeparateFlightsSharingOneItineraryAndTotalsTheFare()
    {
        var (connection, context) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;
        var service = new FlightService(context);
        var returnDay = Day1.AddDays(5);

        var result = await service.CreateItineraryAsync(new CreateItineraryDto
        {
            TripType = FlightTripTypes.RoundTrip,
            Segments =
            {
                Segment("RT-1", "Chennai", "Mumbai", Day1, "08:00", Day1, "10:00"),
                Segment("RT-2", "Mumbai", "Chennai", returnDay, "18:00", returnDay, "20:00")
            }
        }, "user@example.com");

        var flights = await context.Flights.OrderBy(f => f.SegmentOrder).ToListAsync();
        Assert.Equal(2, flights.Count);
        Assert.NotEqual(flights[0].FlightId, flights[1].FlightId);
        Assert.NotNull(flights[0].ItineraryId);
        Assert.Equal(flights[0].ItineraryId, flights[1].ItineraryId);
        Assert.Equal(new int?[] { 1, 2 }, flights.Select(f => f.SegmentOrder).ToArray());
        Assert.All(flights, f => Assert.Equal(FlightTripTypes.RoundTrip, f.TripType));
        Assert.All(flights, f => Assert.Equal("user@example.com", f.CreatedByUserName));
        Assert.Equal(flights.Sum(f => f.Price), result.TotalFare);
    }

    [Fact]
    public async Task MultiCityStoresEverySegmentWithTheSameItineraryInOrder()
    {
        var (connection, context) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;
        var service = new FlightService(context);

        var result = await service.CreateItineraryAsync(new CreateItineraryDto
        {
            TripType = FlightTripTypes.MultiCity,
            Segments =
            {
                Segment("MC-1", "Chennai", "Mumbai", Day1, "06:00", Day1, "08:00"),
                Segment("MC-2", "Mumbai", "Delhi", Day1.AddDays(1), "09:00", Day1.AddDays(1), "11:00"),
                Segment("MC-3", "Delhi", "Kolkata", Day1.AddDays(2), "10:00", Day1.AddDays(2), "12:30")
            }
        }, "user@example.com");

        var flights = await context.Flights.OrderBy(f => f.SegmentOrder).ToListAsync();
        Assert.Equal(3, flights.Count);
        Assert.Single(flights.Select(f => f.ItineraryId).Distinct());
        Assert.Equal(new int?[] { 1, 2, 3 }, flights.Select(f => f.SegmentOrder).ToArray());
        Assert.Equal(flights.Sum(f => f.Price), result.TotalFare);
        Assert.Equal(3, result.Flights.Count);
    }

    [Fact]
    public async Task FailedSegmentRollsBackTheWholeItinerary()
    {
        var (connection, context) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;
        var service = new FlightService(context);

        // An existing flight with the same number + schedule as segment 2.
        await service.CreateFlightAsync(Segment("DUP-9", "Delhi", "Pune", Day1.AddDays(1), "09:00", Day1.AddDays(1), "11:00"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateItineraryAsync(new CreateItineraryDto
        {
            TripType = FlightTripTypes.MultiCity,
            Segments =
            {
                Segment("NEW-1", "Chennai", "Mumbai", Day1, "06:00", Day1, "08:00"),
                Segment("DUP-9", "Mumbai", "Delhi", Day1.AddDays(1), "09:00", Day1.AddDays(1), "11:00")
            }
        }, "user@example.com"));

        Assert.Equal(1, await context.Flights.CountAsync());
        Assert.False(await context.Flights.AnyAsync(f => f.FlightNumber == "NEW-1"));
    }

    [Fact]
    public async Task CreatorIsRequired()
    {
        var (connection, context) = await CreateContextAsync();
        await using var _ = connection;
        await using var __ = context;
        var service = new FlightService(context);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateItineraryAsync(new CreateItineraryDto
        {
            TripType = FlightTripTypes.OneWay,
            Segments = { Segment("OW-2", "Chennai", "Delhi", Day1, "09:00", Day1, "11:30") }
        }, " "));
        Assert.Equal(0, await context.Flights.CountAsync());
    }

    [Fact]
    public void ValidatorRejectsIdenticalOriginAndDestination()
    {
        var request = new CreateItineraryDto
        {
            TripType = FlightTripTypes.OneWay,
            Segments = { Segment("V-1", "Chennai", "chennai", Day1, "09:00", Day1, "11:00") }
        };
        Assert.Contains("different", FlightItineraryValidator.Validate(request, Day1)!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidatorRejectsPastDepartureDates()
    {
        var request = new CreateItineraryDto
        {
            TripType = FlightTripTypes.OneWay,
            Segments = { Segment("V-2", "Chennai", "Delhi", Day1.AddDays(-1), "09:00", Day1.AddDays(-1), "11:00") }
        };
        Assert.Contains("today or later", FlightItineraryValidator.Validate(request, Day1)!);
    }

    [Fact]
    public void ValidatorRequiresReverseRouteAndLaterReturnForRoundTrip()
    {
        var notReversed = new CreateItineraryDto
        {
            TripType = FlightTripTypes.RoundTrip,
            Segments =
            {
                Segment("R-1", "Chennai", "Mumbai", Day1, "08:00", Day1, "10:00"),
                Segment("R-2", "Delhi", "Chennai", Day1.AddDays(2), "08:00", Day1.AddDays(2), "10:00")
            }
        };
        Assert.Contains("reverse", FlightItineraryValidator.Validate(notReversed, Day1)!);

        var returnBefore = new CreateItineraryDto
        {
            TripType = FlightTripTypes.RoundTrip,
            Segments =
            {
                Segment("R-3", "Chennai", "Mumbai", Day1.AddDays(3), "08:00", Day1.AddDays(3), "10:00"),
                Segment("R-4", "Mumbai", "Chennai", Day1.AddDays(1), "08:00", Day1.AddDays(1), "10:00")
            }
        };
        Assert.Contains("after the outbound departure date", FlightItineraryValidator.Validate(returnBefore, Day1)!);
    }

    [Fact]
    public void ValidatorChecksSegmentOrderAndCountForMultiCity()
    {
        var single = new CreateItineraryDto
        {
            TripType = FlightTripTypes.MultiCity,
            Segments = { Segment("M-1", "Chennai", "Mumbai", Day1, "08:00", Day1, "10:00") }
        };
        Assert.Contains("at least 2", FlightItineraryValidator.Validate(single, Day1)!);

        var outOfOrder = new CreateItineraryDto
        {
            TripType = FlightTripTypes.MultiCity,
            Segments =
            {
                Segment("M-2", "Chennai", "Mumbai", Day1.AddDays(2), "08:00", Day1.AddDays(2), "10:00"),
                Segment("M-3", "Mumbai", "Delhi", Day1.AddDays(1), "08:00", Day1.AddDays(1), "10:00")
            }
        };
        Assert.Contains("must depart after flight 1 arrives", FlightItineraryValidator.Validate(outOfOrder, Day1)!);

        var valid = new CreateItineraryDto
        {
            TripType = FlightTripTypes.MultiCity,
            Segments =
            {
                Segment("M-4", "Chennai", "Mumbai", Day1, "08:00", Day1, "10:00"),
                // Origin differs from the previous destination: allowed.
                Segment("M-5", "Pune", "Delhi", Day1.AddDays(1), "08:00", Day1.AddDays(1), "10:00")
            }
        };
        Assert.Null(FlightItineraryValidator.Validate(valid, Day1));
    }

    [Fact]
    public void FareAndDistanceUseTheSharedCalculators()
    {
        var segment = Segment("F-1", "Chennai", "Delhi", Day1, "08:00", Day1, "10:30");
        var distance = FlightItineraryValidator.ResolveDistance(segment);

        Assert.Equal(RouteDistanceCalculator.TryCalculate("Chennai", "Delhi"), distance);
        Assert.Equal(
            Math.Max(distance!.Value * FlightFareCalculator.FarePerKilometer, FlightFareCalculator.MinimumEconomyFare),
            FlightFareCalculator.CalculateBaseFare(distance.Value, "Economy"));
    }
}
