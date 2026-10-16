using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace FlightBookingBackend.Services
{
    public class FlightService : IFlightService
    {
        private readonly FlightBookingDbContext _context;
        private readonly TimeProvider _timeProvider;
        private readonly TimeZoneInfo _businessTimeZone;

        public FlightService(
            FlightBookingDbContext context,
            TimeProvider? timeProvider = null,
            IConfiguration? configuration = null)
        {
            _context = context;
            _timeProvider = timeProvider ?? TimeProvider.System;
            var timeZoneId = configuration?["Coupons:BusinessTimeZoneId"] ?? "Asia/Kolkata";
            _businessTimeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }

        public async Task<IEnumerable<FlightDto>> GetAllFlightsAsync()
        {
            var flights = await _context.Flights
                .AsNoTracking()
                .OrderBy(f => f.DepartureDate)
                .ThenBy(f => f.DepartureTime)
                .ToListAsync();

            return flights.Select(MapToDto);
        }

        public async Task<IEnumerable<FlightDto>> SearchFlightsAsync(FlightSearchQueryDto query)
        {
            var q = _context.Flights.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(query.FromCity))
            {
                var fromTerm = query.FromCity.Trim().ToLower();
                q = q.Where(f => f.FromCity.ToLower() == fromTerm ||
                                 (f.FromAirportCode != null && f.FromAirportCode.ToLower() == fromTerm));
            }

            if (!string.IsNullOrWhiteSpace(query.ToCity))
            {
                var toTerm = query.ToCity.Trim().ToLower();
                q = q.Where(f => f.ToCity.ToLower() == toTerm ||
                                 (f.ToAirportCode != null && f.ToAirportCode.ToLower() == toTerm));
            }

            if (query.DepartureDate.HasValue)
            {
                q = q.Where(f => f.DepartureDate == query.DepartureDate.Value);
            }
            else
            {
                var localNow = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
                var today = DateOnly.FromDateTime(localNow.DateTime);
                q = q.Where(f => f.DepartureDate >= today);
            }

            var requiredSeats = Math.Max(
                query.Passengers,
                query.Adults + query.Children + query.Infants);
            if (requiredSeats > 0)
            {
                q = q.Where(f => f.AvailableSeats >= requiredSeats);
            }

            q = q.Where(f => f.Status.ToLower() == "scheduled");

            if (query.DirectFlight)
            {
                q = q.Where(f => f.StopCount == 0);
            }

            if (!string.IsNullOrWhiteSpace(query.Airline))
            {
                var airline = query.Airline.Trim().ToLower();
                q = q.Where(f => f.Airline.ToLower() == airline);
            }

            if (!string.IsNullOrWhiteSpace(query.FlightNumber))
            {
                var flightNumber = query.FlightNumber.Trim().ToLower();
                q = q.Where(f => f.FlightNumber.ToLower().Contains(flightNumber));
            }

            var localTime = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
            var localToday = DateOnly.FromDateTime(localTime.DateTime);
            var currentTime = TimeOnly.FromDateTime(localTime.DateTime);
            var flights = await q
                .OrderBy(f => f.DepartureDate)
                .ThenBy(f => f.DepartureTime)
                .ToListAsync();

            return flights
                .Where(f => f.DepartureDate > localToday ||
                            (f.DepartureDate == localToday &&
                             TimeOnly.TryParse(f.DepartureTime, out var departureTime) &&
                             departureTime > currentTime))
                .Select(MapToDto)
                .OrderBy(f => f.DepartureDate)
                .ThenBy(f => f.DepartureTime)
                .ThenBy(f => f.Price);
        }

        public async Task<IEnumerable<FlightDto>> GetFlightsByRouteAsync(string fromCity, string toCity)
        {
            var fromTerm = fromCity.Trim().ToLower();
            var toTerm = toCity.Trim().ToLower();

            var flights = await _context.Flights
                .AsNoTracking()
                .Where(f => f.FromCity.ToLower() == fromTerm &&
                            f.ToCity.ToLower() == toTerm)
                .OrderBy(f => f.DepartureDate)
                .ThenBy(f => f.DepartureTime)
                .ToListAsync();

            return flights.Select(MapToDto);
        }

        public async Task<IEnumerable<FlightDto>> SearchFlightsByRouteAsync(string from, string to, DateOnly date)
        {
            var fromTerm = from.Trim().ToLower();
            var toTerm = to.Trim().ToLower();

            var flights = await _context.Flights
                .AsNoTracking()
                .Where(f => f.FromCity.ToLower() == fromTerm &&
                            f.ToCity.ToLower() == toTerm &&
                            f.DepartureDate == date)
                .OrderBy(f => f.DepartureTime)
                .ToListAsync();

            return flights.Select(MapToDto);
        }

        public async Task<FlightDto?> GetFlightByIdAsync(int flightId)
        {
            var flight = await _context.Flights
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.FlightId == flightId);

            return flight == null ? null : MapToDto(flight);
        }

        public async Task<bool> DeleteFlightAsync(int flightId)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable);

            var flight = await _context.Flights
                .FirstOrDefaultAsync(f => f.FlightId == flightId);
            if (flight == null)
            {
                await transaction.RollbackAsync();
                return false;
            }

            var hasBookings = await _context.Bookings.AnyAsync(b => b.FlightId == flightId);
            if (hasBookings)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException(
                    "This flight cannot be deleted because it has associated bookings.");
            }

            _context.Flights.Remove(flight);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return true;
        }

        public async Task<IEnumerable<string>> GetUniqueCitiesAsync()
        {
            var fromCities = await _context.Flights.Select(f => f.FromCity).Distinct().ToListAsync();
            var toCities = await _context.Flights.Select(f => f.ToCity).Distinct().ToListAsync();

            return fromCities.Union(toCities).Distinct().OrderBy(c => c).ToList();
        }

        public async Task<FlightSearchOptionsDto> GetSearchOptionsAsync()
        {
            var flights = await _context.Flights
                .AsNoTracking()
                .Select(f => new
                {
                    f.FromCity,
                    f.ToCity,
                    f.FromAirportCode,
                    f.ToAirportCode,
                    f.Airline
                })
                .ToListAsync();

            var locations = flights
                .SelectMany(f => new[] { f.FromCity, f.ToCity, f.FromAirportCode, f.ToAirportCode })
                .Where(location => !string.IsNullOrWhiteSpace(location))
                .Select(location => location!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(location => location)
                .ToArray();
            var airlines = flights
                .Select(f => f.Airline.Trim())
                .Where(airline => !string.IsNullOrWhiteSpace(airline))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(airline => airline)
                .ToArray();

            return new FlightSearchOptionsDto { Locations = locations, Airlines = airlines };
        }

        public async Task<FlightDto> CreateFlightAsync(CreateFlightDto dto)
        {
            var result = await CreateFlightsCoreAsync(
                FlightTripTypes.OneWay, new[] { dto }, null, validateBusinessRules: false);
            return result.Flights[0];
        }

        public async Task<FlightDto> CreateFlightAsync(CreateFlightDto dto, string creatorUserName)
        {
            if (string.IsNullOrWhiteSpace(creatorUserName))
                throw new ArgumentException("A valid authenticated username is required.", nameof(creatorUserName));

            var result = await CreateFlightsCoreAsync(
                FlightTripTypes.OneWay, new[] { dto }, creatorUserName, validateBusinessRules: false);
            return result.Flights[0];
        }

        public async Task<ItineraryResultDto> CreateItineraryAsync(CreateItineraryDto request, string creatorUserName)
        {
            if (string.IsNullOrWhiteSpace(creatorUserName))
                throw new ArgumentException("A valid authenticated username is required.", nameof(creatorUserName));

            var localNow = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
            var validationError = FlightItineraryValidator.Validate(request, DateOnly.FromDateTime(localNow.DateTime));
            if (validationError != null)
                throw new ArgumentException(validationError);

            return await CreateFlightsCoreAsync(
                request.TripType, request.Segments, creatorUserName, validateBusinessRules: true);
        }

        /// <summary>
        /// Saves every segment in a single serializable transaction: either the whole itinerary is stored
        /// or nothing is. Each segment becomes its own Flights row with its own FlightId.
        /// </summary>
        private async Task<ItineraryResultDto> CreateFlightsCoreAsync(
            string tripType,
            IReadOnlyList<CreateFlightDto> segments,
            string? creatorUserName,
            bool validateBusinessRules)
        {
            var itineraryId = tripType == FlightTripTypes.OneWay ? (Guid?)null : Guid.NewGuid();
            var username = string.IsNullOrWhiteSpace(creatorUserName) ? null : creatorUserName.Trim();
            if (username is { Length: > 150 })
                username = username[..150];

            await using var transaction = await _context.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable);

            var created = new List<Flight>(segments.Count);
            try
            {
                for (var index = 0; index < segments.Count; index++)
                {
                    var dto = segments[index];
                    var flightNumber = dto.FlightNumber.Trim();
                    var departureTime = dto.DepartureTime.Trim();
                    var label = FlightItineraryValidator.SegmentLabel(tripType, index);

                    var duplicateExists = await _context.Flights.AnyAsync(f =>
                        f.FlightNumber.ToUpper() == flightNumber.ToUpper() &&
                        f.DepartureDate == dto.DepartureDate &&
                        f.DepartureTime == departureTime);
                    if (duplicateExists)
                    {
                        await transaction.RollbackAsync();
                        throw new InvalidOperationException(validateBusinessRules
                            ? $"{label}: a flight with this number and departure schedule already exists."
                            : "A flight with this number and departure schedule already exists.");
                    }

                    var distanceKm = validateBusinessRules
                        ? FlightItineraryValidator.ResolveDistance(dto)
                        : dto.DistanceKm;
                    if (distanceKm is null or <= 0m)
                    {
                        await transaction.RollbackAsync();
                        throw new ArgumentException($"{label}: route distance could not be determined for this route.");
                    }

                    var flight = new Flight
                    {
                        FlightNumber = flightNumber,
                        Airline = dto.Airline.Trim(),
                        FromCity = dto.FromCity.Trim(),
                        ToCity = dto.ToCity.Trim(),
                        FromAirportCode = NormalizeAirportCode(dto.FromAirportCode),
                        ToAirportCode = NormalizeAirportCode(dto.ToAirportCode),
                        StopCount = dto.StopCount,
                        DepartureDate = dto.DepartureDate,
                        DepartureTime = departureTime,
                        ArrivalDate = dto.ArrivalDate,
                        ArrivalTime = dto.ArrivalTime.Trim(),
                        Duration = dto.Duration.Trim(),
                        DistanceKm = distanceKm.Value,
                        TotalSeats = dto.TotalSeats,
                        AvailableSeats = dto.AvailableSeats,
                        // Single shared fare formula (distance x rate, with minimum) used everywhere.
                        Price = FlightFareCalculator.CalculateBaseFare(distanceKm.Value, "Economy"),
                        Status = string.IsNullOrWhiteSpace(dto.Status) ? "Scheduled" : dto.Status.Trim(),
                        CreatedByUserName = username,
                        TripType = tripType,
                        ItineraryId = itineraryId,
                        SegmentOrder = itineraryId.HasValue ? index + 1 : null
                    };

                    _context.Flights.Add(flight);
                    created.Add(flight);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                // Nothing was committed. Detach the unsaved flights so a reused DbContext cannot persist them later.
                foreach (var flight in created)
                {
                    _context.Entry(flight).State = EntityState.Detached;
                }
                throw;
            }

            var flights = created.Select(MapToDto).ToList();
            return new ItineraryResultDto
            {
                TripType = tripType,
                ItineraryId = itineraryId,
                TotalFare = flights.Sum(f => f.Price),
                Message = "Your flight creation was successful!",
                Flights = flights
            };
        }

        public async Task<FlightDto?> UpdateFlightAsync(int flightId, CreateFlightDto dto)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable);

            var flight = await _context.Flights.FirstOrDefaultAsync(f => f.FlightId == flightId);
            if (flight == null)
            {
                await transaction.RollbackAsync();
                return null;
            }

            if (await _context.Bookings.AnyAsync(b => b.FlightId == flightId))
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException(
                    "This flight cannot be edited because it has associated bookings.");
            }

            var flightNumber = dto.FlightNumber.Trim();
            var departureTime = dto.DepartureTime.Trim();
            var duplicateExists = await _context.Flights.AnyAsync(f =>
                f.FlightId != flightId &&
                f.FlightNumber.ToUpper() == flightNumber.ToUpper() &&
                f.DepartureDate == dto.DepartureDate &&
                f.DepartureTime == departureTime);
            if (duplicateExists)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException("A flight with this number and departure schedule already exists.");
            }

            flight.FlightNumber = flightNumber;
            flight.Airline = dto.Airline.Trim();
            flight.FromCity = dto.FromCity.Trim();
            flight.ToCity = dto.ToCity.Trim();
            flight.FromAirportCode = NormalizeAirportCode(dto.FromAirportCode);
            flight.ToAirportCode = NormalizeAirportCode(dto.ToAirportCode);
            flight.StopCount = dto.StopCount;
            flight.DistanceKm = dto.DistanceKm;
            flight.DepartureDate = dto.DepartureDate;
            flight.DepartureTime = departureTime;
            flight.ArrivalDate = dto.ArrivalDate;
            flight.ArrivalTime = dto.ArrivalTime.Trim();
            flight.Duration = dto.Duration.Trim();
            flight.TotalSeats = dto.TotalSeats;
            flight.AvailableSeats = dto.AvailableSeats;
            flight.Price = FlightFareCalculator.CalculateBaseFare(dto.DistanceKm, "Economy");
            flight.Status = string.IsNullOrWhiteSpace(dto.Status) ? flight.Status : dto.Status.Trim();

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return MapToDto(flight);
        }

        private static FlightDto MapToDto(Flight f) => new FlightDto
        {
            FlightId = f.FlightId,
            FlightNumber = f.FlightNumber,
            Airline = f.Airline,
            FromCity = f.FromCity,
            ToCity = f.ToCity,
            FromAirportCode = f.FromAirportCode,
            ToAirportCode = f.ToAirportCode,
            StopCount = f.StopCount,
            DepartureDate = f.DepartureDate,
            DepartureTime = f.DepartureTime,
            ArrivalDate = f.ArrivalDate,
            ArrivalTime = f.ArrivalTime,
            Duration = f.Duration,
            DistanceKm = f.DistanceKm,
            TotalSeats = f.TotalSeats,
            AvailableSeats = f.AvailableSeats,
            Price = f.DistanceKm is > 0m
                ? (f.Price > 0m ? Math.Round(f.Price, 0, MidpointRounding.AwayFromZero) : FlightFareCalculator.ResolveBaseFare(f.DistanceKm))
                : 0m,
            Status = f.Status,
            CreatedByUserName = f.CreatedByUserName,
            TripType = f.TripType,
            ItineraryId = f.ItineraryId,
            SegmentOrder = f.SegmentOrder
        };

        private static string? NormalizeAirportCode(string? code) =>
            string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();
    }
}
