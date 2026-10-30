using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlightBookingBackend.Tests;

public class FlightServiceTests
{
    [Fact]
    public async Task DeleteFlightRemovesOnlyTheRequestedFlightAndReturnsFalseWhenMissing()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var flightToDelete = CreateFlight("DEL-100");
        var otherFlight = CreateFlight("KEEP-100");
        context.Flights.AddRange(flightToDelete, otherFlight);
        await context.SaveChangesAsync();

        var service = new FlightService(context);
        Assert.True(await service.DeleteFlightAsync(flightToDelete.FlightId));
        Assert.False(await service.DeleteFlightAsync(flightToDelete.FlightId));
        Assert.Equal(otherFlight.FlightId, await context.Flights.Select(f => f.FlightId).SingleAsync());
    }

    [Fact]
    public async Task DeleteFlightRejectsFlightWithAssociatedBookings()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var user = new User
        {
            FullName = "Test Passenger",
            Username = "delete-test@example.test",
            Email = "delete-test@example.test",
            PhoneNumber = "555-0100",
            PasswordHash = "test-hash",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        var flight = CreateFlight("BOOKED-100");
        context.AddRange(user, flight);
        await context.SaveChangesAsync();

        context.Bookings.Add(new Booking
        {
            BookingReference = "BOOKING-DELETE-TEST",
            UserId = user.Id,
            FlightId = flight.FlightId,
            PassengerName = user.FullName,
            PassengerEmail = user.Email,
            PassengerPhone = user.PhoneNumber,
            PassengerAge = 30,
            PassengerGender = "Other",
            SeatNumber = "1A",
            Class = "Economy",
            BookingDate = DateTime.UtcNow,
            FlightJourneyDate = flight.DepartureDate,
            DistanceKm = flight.DistanceKm,
            BaseFare = flight.Price,
            Taxes = flight.Price * 0.1m,
            TicketPrice = flight.Price * 1.1m,
            BookingStatus = "Confirmed",
            PaymentStatus = "Paid"
        });
        await context.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => new FlightService(context).DeleteFlightAsync(flight.FlightId));

        Assert.Contains("associated bookings", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.True(await context.Flights.AnyAsync(f => f.FlightId == flight.FlightId));
        Assert.Equal(1, await context.Bookings.CountAsync(b => b.FlightId == flight.FlightId));
    }

    [Fact]
    public async Task CreateFlightPersistsFlightAndRejectsDuplicateSchedule()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var request = new CreateFlightDto
        {
            FlightNumber = "FB-100",
            Airline = "Test Airways",
            FromCity = "Chennai",
            ToCity = "Bangalore",
            StopCount = 0,
            DepartureDate = new DateOnly(2026, 10, 12),
            DepartureTime = "10:00",
            ArrivalDate = new DateOnly(2026, 10, 12),
            ArrivalTime = "11:00",
            Duration = "1h",
            DistanceKm = 10m,
            TotalSeats = 20,
            AvailableSeats = 20,
            Status = "Scheduled"
        };
        var service = new FlightService(context);

        var created = await service.CreateFlightAsync(request);

        Assert.True(created.FlightId > 0);
        Assert.Equal(1, await context.Flights.CountAsync());
        Assert.Equal(1500m, await context.Flights.Select(f => f.Price).SingleAsync());
        Assert.Equal(0, created.StopCount);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateFlightAsync(request));
        Assert.Equal(1, await context.Flights.CountAsync());
    }

    [Fact]
    public async Task SearchFlightsFiltersByAirportScheduleCapacityStopsAirlineAndFlightNumber()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var travelDate = new DateOnly(2026, 10, 13);
        context.Flights.AddRange(
            new Flight
            {
                FlightNumber = "AI-101",
                Airline = "Air India",
                FromCity = "Chennai",
                ToCity = "Bengaluru",
                StopCount = 0,
                DepartureDate = travelDate,
                DepartureTime = "14:00",
                ArrivalDate = travelDate,
                ArrivalTime = "15:00",
                Duration = "1h",
                DistanceKm = 300m,
                TotalSeats = 10,
                AvailableSeats = 4,
                Price = 3000m,
                Status = "Scheduled"
            },
            new Flight
            {
                FlightNumber = "AI-102",
                Airline = "Air India",
                FromCity = "Chennai",
                ToCity = "Bengaluru",
                StopCount = 1,
                DepartureDate = travelDate,
                DepartureTime = "16:00",
                ArrivalDate = travelDate,
                ArrivalTime = "18:00",
                Duration = "2h",
                DistanceKm = 300m,
                TotalSeats = 10,
                AvailableSeats = 10,
                Price = 2500m,
                Status = "Scheduled"
            },
            new Flight
            {
                FlightNumber = "AI-103",
                Airline = "Air India",
                FromCity = "Chennai",
                ToCity = "Bengaluru",
                StopCount = 0,
                DepartureDate = travelDate,
                DepartureTime = "17:00",
                ArrivalDate = travelDate,
                ArrivalTime = "18:00",
                Duration = "1h",
                DistanceKm = 300m,
                TotalSeats = 10,
                AvailableSeats = 2,
                Price = 2800m,
                Status = "Scheduled"
            },
            new Flight
            {
                FlightNumber = "AI-104",
                Airline = "Air India",
                FromCity = "Chennai",
                ToCity = "Bengaluru",
                StopCount = 0,
                DepartureDate = travelDate,
                DepartureTime = "18:00",
                ArrivalDate = travelDate,
                ArrivalTime = "19:00",
                Duration = "1h",
                DistanceKm = 300m,
                TotalSeats = 10,
                AvailableSeats = 10,
                Price = 3100m,
                Status = "Cancelled"
            });
        await context.SaveChangesAsync();

        var service = new FlightService(
            context,
            new FixedTimeProvider(new DateTimeOffset(2026, 10, 12, 6, 0, 0, TimeSpan.Zero)));
        var results = await service.SearchFlightsAsync(new FlightSearchQueryDto
        {
            FromCity = "Chennai",
            ToCity = "Bengaluru",
            DepartureDate = travelDate,
            Passengers = 3,
            Adults = 1,
            Children = 2,
            Airline = "Air India",
            FlightNumber = "AI-10",
            DirectFlight = true
        });

        var result = Assert.Single(results);
        Assert.Equal("AI-101", result.FlightNumber);
        Assert.Equal(3000m, result.Price);

        var searchOptions = await service.GetSearchOptionsAsync();
        Assert.Contains("Chennai", searchOptions.Locations);
        Assert.Contains("Bengaluru", searchOptions.Locations);
        Assert.Contains("Air India", searchOptions.Airlines);
    }

    [Fact]
    public async Task UpdateFlightPersistsChangesAndRecalculatesTheFare()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();
        var flight = CreateFlight("UPD-100");
        context.Flights.Add(flight);
        await context.SaveChangesAsync();

        var updated = await new FlightService(context).UpdateFlightAsync(flight.FlightId, new CreateFlightDto
        {
            FlightNumber = "UPD-101",
            Airline = "Updated Airways",
            FromCity = "Mumbai",
            ToCity = "Delhi",
            DistanceKm = 500m,
            DepartureDate = new DateOnly(2026, 11, 1),
            DepartureTime = "12:00",
            ArrivalDate = new DateOnly(2026, 11, 1),
            ArrivalTime = "14:00",
            Duration = "2h",
            TotalSeats = 30,
            AvailableSeats = 24,
            Status = "Scheduled"
        });

        Assert.NotNull(updated);
        Assert.Equal("UPD-101", updated!.FlightNumber);
        Assert.Equal("Mumbai", updated.FromCity);
        Assert.Equal(5000m, updated.Price);
        Assert.Equal(5000m, (await context.Flights.SingleAsync()).Price);
    }

    [Fact]
    public async Task RouteSearchDoesNotTrustStalePriceWhenDistanceIsInvalid()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        context.Flights.Add(new Flight
        {
            FlightNumber = "TEST-123",
            Airline = "Test Airways",
            FromCity = "Chennai",
            ToCity = "Bangalore",
            DepartureDate = new DateOnly(2026, 10, 10),
            DepartureTime = "10:00",
            ArrivalDate = new DateOnly(2026, 10, 10),
            ArrivalTime = "11:00",
            Duration = "1h",
            DistanceKm = 0m,
            TotalSeats = 10,
            AvailableSeats = 10,
            Price = 1234.56m,
            Status = "Scheduled"
        });
        await context.SaveChangesAsync();

        var flights = await new FlightService(context).GetFlightsByRouteAsync("Chennai", "Bangalore");

        var flight = Assert.Single(flights);
        Assert.Equal(0m, flight.Price);
        Assert.Equal(0m, flight.DistanceKm);
    }

    [Fact]
    public async Task RouteSearchRecalculatesLegacyFareFromRouteDistance()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        context.Flights.Add(new Flight
        {
            FlightNumber = "TEST-456",
            Airline = "Test Airways",
            FromCity = "Chennai",
            ToCity = "Bangalore",
            DepartureDate = new DateOnly(2026, 10, 10),
            DepartureTime = "10:00",
            ArrivalDate = new DateOnly(2026, 10, 10),
            ArrivalTime = "11:00",
            Duration = "1h",
            DistanceKm = 100m,
            TotalSeats = 10,
            AvailableSeats = 10,
            Price = 0m,
            Status = "Scheduled"
        });
        await context.SaveChangesAsync();

        var flights = await new FlightService(context).GetFlightsByRouteAsync("Chennai", "Bangalore");

        Assert.Equal(1500m, Assert.Single(flights).Price);
    }

    [Fact]
    public async Task RouteSearchDoesNotInventFareWhenDistanceIsMissing()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        context.Flights.Add(new Flight
        {
            FlightNumber = "TEST-789",
            Airline = "Test Airways",
            FromCity = "Chennai",
            ToCity = "Bangalore",
            DepartureDate = new DateOnly(2026, 10, 10),
            DepartureTime = "10:00",
            ArrivalDate = new DateOnly(2026, 10, 10),
            ArrivalTime = "11:00",
            Duration = "1h",
            DistanceKm = null,
            TotalSeats = 10,
            AvailableSeats = 10,
            Price = 0m,
            Status = "Scheduled"
        });
        await context.SaveChangesAsync();

        var flights = await new FlightService(context).GetFlightsByRouteAsync("Chennai", "Bangalore");

        Assert.Equal(0m, Assert.Single(flights).Price);
    }

    [Fact]
    public async Task CreateAndRetrieveFlightStoresAndReturnsBookingDateSeparatelyFromDepartureDate()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var service = new FlightService(context);
        var bookingDate = new DateOnly(2026, 10, 17);
        var departureDate = new DateOnly(2026, 10, 25);

        var createDto = new CreateFlightDto
        {
            FlightNumber = "BK-2026",
            Airline = "SkyWings",
            FromCity = "Chennai",
            ToCity = "Mumbai",
            BookingDate = bookingDate,
            DepartureDate = departureDate,
            DepartureTime = "09:00",
            ArrivalDate = departureDate,
            ArrivalTime = "11:00",
            Duration = "2h",
            DistanceKm = 1030m,
            TotalSeats = 150,
            AvailableSeats = 150,
            Status = "Scheduled"
        };

        var created = await service.CreateFlightAsync(createDto, "admin@example.com");
        Assert.NotNull(created);
        Assert.Equal(bookingDate, created.BookingDate);
        Assert.Equal(departureDate, created.DepartureDate);
        Assert.NotEqual(created.BookingDate, created.DepartureDate);

        var retrieved = await service.GetFlightByIdAsync(created.FlightId);
        Assert.NotNull(retrieved);
        Assert.Equal(bookingDate, retrieved.BookingDate);
        Assert.Equal(departureDate, retrieved.DepartureDate);

        // Test update flight booking date
        var newBookingDate = new DateOnly(2026, 10, 18);
        createDto.BookingDate = newBookingDate;
        var updated = await service.UpdateFlightAsync(created.FlightId, createDto);
        Assert.NotNull(updated);
        Assert.Equal(newBookingDate, updated.BookingDate);
        Assert.Equal(departureDate, updated.DepartureDate);
    }

    [Fact]
    public async Task CreateFlightWithManualPricePersistsCustomFare()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var request = new CreateFlightDto
        {
            FlightNumber = "AI-777",
            Airline = "Air India",
            FromCity = "Chennai",
            ToCity = "Delhi",
            DepartureDate = new DateOnly(2026, 11, 15),
            DepartureTime = "08:00",
            ArrivalDate = new DateOnly(2026, 11, 15),
            ArrivalTime = "10:30",
            Duration = "2h 30m",
            DistanceKm = 1750m,
            Price = 6450m,
            TotalSeats = 180,
            AvailableSeats = 180,
            Status = "Scheduled"
        };
        var service = new FlightService(context);
        var created = await service.CreateFlightAsync(request);

        Assert.NotNull(created);
        Assert.Equal(6450m, created.Price);
        var persistedFlight = await context.Flights.FindAsync(created.FlightId);
        Assert.NotNull(persistedFlight);
        Assert.Equal(6450m, persistedFlight.Price);

        // Update with another price
        request.Price = 7200m;
        var updated = await service.UpdateFlightAsync(created.FlightId, request);
        Assert.NotNull(updated);
        Assert.Equal(7200m, updated.Price);
        await context.Entry(persistedFlight).ReloadAsync();
        Assert.Equal(7200m, persistedFlight.Price);
    }

    private static Flight CreateFlight(string flightNumber) => new()
    {
        FlightNumber = flightNumber,
        Airline = "Test Airways",
        FromCity = "Chennai",
        ToCity = "Bangalore",
        DepartureDate = new DateOnly(2026, 10, 12),
        DepartureTime = "10:00",
        ArrivalDate = new DateOnly(2026, 10, 12),
        ArrivalTime = "11:00",
        Duration = "1h",
        DistanceKm = 100m,
        TotalSeats = 20,
        AvailableSeats = 20,
        Price = 1500m,
        Status = "Scheduled"
    };

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
