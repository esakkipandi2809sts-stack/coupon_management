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
            var localNow = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
            var localToday = DateOnly.FromDateTime(localNow.DateTime);

            if (!string.IsNullOrWhiteSpace(query.FromCity) &&
                !string.IsNullOrWhiteSpace(query.ToCity) &&
                query.DepartureDate.HasValue &&
                query.DepartureDate.Value >= localToday)
            {
                var fromTerm = query.FromCity.Trim().ToLower();
                var toTerm = query.ToCity.Trim().ToLower();

                var routeHasFlights = await _context.Flights
                    .AnyAsync(f => (f.FromCity.ToLower() == fromTerm || f.FromCity.ToLower().Contains(fromTerm) || fromTerm.Contains(f.FromCity.ToLower())) &&
                                   (f.ToCity.ToLower() == toTerm || f.ToCity.ToLower().Contains(toTerm) || toTerm.Contains(f.ToCity.ToLower())) &&
                                   f.DepartureDate == query.DepartureDate.Value);

                if (!routeHasFlights)
                {
                    await GenerateRealisticRouteFlightsAsync(query.FromCity, query.ToCity, query.DepartureDate.Value);
                }
            }

            var q = _context.Flights.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(query.FromCity))
            {
                var fromTerm = query.FromCity.Trim().ToLower();
                q = q.Where(f => f.FromCity.ToLower() == fromTerm);
            }

            if (!string.IsNullOrWhiteSpace(query.ToCity))
            {
                var toTerm = query.ToCity.Trim().ToLower();
                q = q.Where(f => f.ToCity.ToLower() == toTerm);
            }

            if (query.DepartureDate.HasValue)
            {
                q = q.Where(f => f.DepartureDate == query.DepartureDate.Value);
            }
            else
            {
                q = q.Where(f => f.DepartureDate >= localToday);
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

            var currentTime = TimeOnly.FromDateTime(localNow.DateTime);
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
                .Where(f => (f.FromCity.ToLower() == fromTerm || f.FromCity.ToLower().Contains(fromTerm) || fromTerm.Contains(f.FromCity.ToLower())) &&
                            (f.ToCity.ToLower() == toTerm || f.ToCity.ToLower().Contains(toTerm) || toTerm.Contains(f.ToCity.ToLower())))
                .OrderBy(f => f.DepartureDate)
                .ThenBy(f => f.DepartureTime)
                .ToListAsync();

            return flights.Select(MapToDto);
        }

        public async Task<IEnumerable<FlightDto>> SearchFlightsByRouteAsync(string from, string to, DateOnly date)
        {
            var fromTerm = from.Trim().ToLower();
            var toTerm = to.Trim().ToLower();
            var localNow = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
            var localToday = DateOnly.FromDateTime(localNow.DateTime);

            var flights = await _context.Flights
                .AsNoTracking()
                .Where(f => (f.FromCity.ToLower() == fromTerm || f.FromCity.ToLower().Contains(fromTerm) || fromTerm.Contains(f.FromCity.ToLower())) &&
                            (f.ToCity.ToLower() == toTerm || f.ToCity.ToLower().Contains(toTerm) || toTerm.Contains(f.ToCity.ToLower())) &&
                            f.DepartureDate == date)
                .OrderBy(f => f.DepartureTime)
                .ToListAsync();

            if (flights.Count == 0 && date >= localToday)
            {
                var generated = await GenerateRealisticRouteFlightsAsync(from, to, date);
                flights = generated.ToList();
            }

            return flights.Select(MapToDto);
        }

        public async Task<FlightDto?> GetFlightByIdAsync(int flightId)
        {
            var flight = await _context.Flights
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.FlightId == flightId);

            if (flight == null) return null;

            var dto = MapToDto(flight);
            dto.BookedSeats = await GetBookedSeatsAsync(flightId);
            return dto;
        }

        public async Task<List<string>> GetBookedSeatsAsync(int flightId)
        {
            return await _context.Bookings
                .AsNoTracking()
                .Where(b => b.FlightId == flightId &&
                            b.BookingStatus != BookingStatuses.Cancelled &&
                            b.BookingStatus != BookingStatuses.Failed &&
                            !string.IsNullOrWhiteSpace(b.SeatNumber))
                .Select(b => b.SeatNumber.Trim().ToUpper())
                .Distinct()
                .ToListAsync();
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
                    f.Airline
                })
                .ToListAsync();

            var locations = flights
                .SelectMany(f => new[] { f.FromCity, f.ToCity })
                .Where(location => !string.IsNullOrWhiteSpace(location))
                .Select(location => location.Trim())
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

        public Task<FlightDto> CreateFlightAsync(CreateFlightDto dto) =>
            CreateFlightAsync(dto, null);

        public async Task<FlightDto> CreateFlightAsync(CreateFlightDto dto, string? creatorUserName)
        {
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
                        : (dto.DistanceKm is > 0m ? dto.DistanceKm : FlightItineraryValidator.ResolveDistance(dto));
                    if (distanceKm is null or <= 0m)
                    {
                        await transaction.RollbackAsync();
                        throw new ArgumentException($"{label}: route distance could not be determined for this route.");
                    }

                    var localNow = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
                    var today = DateOnly.FromDateTime(localNow.DateTime);

                    var flight = new Flight
                    {
                        FlightNumber = flightNumber,
                        Airline = dto.Airline.Trim(),
                        FromCity = dto.FromCity.Trim(),
                        ToCity = dto.ToCity.Trim(),
                        StopCount = dto.StopCount ?? 0,
                        BookingDate = dto.BookingDate ?? today,
                        DepartureDate = dto.DepartureDate,
                        DepartureTime = departureTime,
                        ArrivalDate = dto.ArrivalDate,
                        ArrivalTime = dto.ArrivalTime.Trim(),
                        Duration = dto.Duration.Trim(),
                        DistanceKm = distanceKm.Value,
                        TotalSeats = dto.TotalSeats,
                        AvailableSeats = dto.AvailableSeats,
                        // Use manually entered price if provided, otherwise compute from route distance.
                        Price = dto.Price is > 0m
                            ? Math.Round(dto.Price.Value, 0, MidpointRounding.AwayFromZero)
                            : FlightFareCalculator.CalculateEconomyFare(distanceKm.Value, departureTime, flightNumber, dto.Airline),
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
                try
                {
                    await transaction.RollbackAsync();
                }
                catch
                {
                    // Ignore if transaction was already aborted or rolled back
                }

                // Nothing was committed. Detach the unsaved flights so a reused DbContext cannot persist them later.
                foreach (var flight in created)
                {
                    _context.Entry(flight).State = EntityState.Detached;
                }
                throw;
            }

            // Success is only reported once the rows are read back from the database the context is
            // actually connected to. If they are not there, fail loudly instead of returning success.
            var savedIds = created.Select(f => f.FlightId).ToList();
            var persistedCount = savedIds.All(id => id > 0)
                ? await _context.Flights.AsNoTracking().CountAsync(f => savedIds.Contains(f.FlightId))
                : 0;
            if (persistedCount != created.Count)
            {
                throw new DbUpdateException(
                    $"Flight save was reported as committed but only {persistedCount} of {created.Count} " +
                    $"row(s) were found in database '{_context.Database.GetDbConnection().Database}' " +
                    $"on server '{_context.Database.GetDbConnection().DataSource}'.");
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
            flight.StopCount = dto.StopCount ?? 0;
            if (dto.BookingDate.HasValue)
            {
                flight.BookingDate = dto.BookingDate.Value;
            }
            flight.DistanceKm = dto.DistanceKm;
            flight.DepartureDate = dto.DepartureDate;
            flight.DepartureTime = departureTime;
            flight.ArrivalDate = dto.ArrivalDate;
            flight.ArrivalTime = dto.ArrivalTime.Trim();
            flight.Duration = dto.Duration.Trim();
            flight.TotalSeats = dto.TotalSeats;
            flight.AvailableSeats = dto.AvailableSeats;
            flight.Price = dto.Price is > 0m
                ? Math.Round(dto.Price.Value, 0, MidpointRounding.AwayFromZero)
                : FlightFareCalculator.CalculateEconomyFare(dto.DistanceKm, departureTime, flightNumber, dto.Airline);
            flight.Status = string.IsNullOrWhiteSpace(dto.Status) ? flight.Status : dto.Status.Trim();

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return MapToDto(flight);
        }

        private static FlightDto MapToDto(Flight f)
        {
            var stopCount = f.StopCount ?? 0;
            string duration = f.Duration;
            if (!string.IsNullOrWhiteSpace(duration) && (duration.Contains('–') || duration.Contains('-')))
            {
                var split = duration.Split(new[] { '–', '-' }, StringSplitOptions.RemoveEmptyEntries);
                if (split.Length > 0) duration = split[0].Trim();
            }
            if (string.IsNullOrWhiteSpace(duration) && f.DistanceKm is > 0m)
            {
                var durationMinutes = (int)Math.Max(30d, Math.Round(((double)f.DistanceKm.Value / 780d * 60d + 30d) / 5d) * 5d);
                duration = FormatDurationMinutes(durationMinutes);
            }

            return new FlightDto
            {
                FlightId = f.FlightId,
                FlightNumber = f.FlightNumber,
                Airline = f.Airline,
                FromCity = f.FromCity,
                ToCity = f.ToCity,
                StopCount = stopCount,
                BookingDate = f.BookingDate,
                DepartureDate = f.DepartureDate,
                DepartureTime = f.DepartureTime,
                ArrivalDate = f.ArrivalDate,
                ArrivalTime = f.ArrivalTime,
                Duration = duration,
                DistanceKm = f.DistanceKm,
                TotalSeats = f.TotalSeats,
                AvailableSeats = f.AvailableSeats,
                Price = f.DistanceKm is > 0m
                    ? (f.Price > 0m ? Math.Round(f.Price, 0, MidpointRounding.AwayFromZero) : FlightFareCalculator.ResolveBaseFare(f.DistanceKm, f.DepartureTime, f.FlightNumber, f.Airline))
                    : 0m,
                Status = f.Status,
                CreatedByUserName = f.CreatedByUserName,
                TripType = f.TripType,
                ItineraryId = f.ItineraryId,
                SegmentOrder = f.SegmentOrder
            };
        }

        private static string FormatDurationMinutes(int totalMinutes)
        {
            var hours = totalMinutes / 60;
            var mins = totalMinutes % 60;
            var parts = new List<string>();
            if (hours > 0) parts.Add($"{hours}h");
            if (mins > 0) parts.Add($"{mins}m");
            return parts.Count > 0 ? string.Join(" ", parts) : "0m";
        }

        private async Task<List<Flight>> GenerateRealisticRouteFlightsAsync(string from, string to, DateOnly date)
        {
            var localNow = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
            var localToday = DateOnly.FromDateTime(localNow.DateTime);

            var distance = RouteDistanceCalculator.TryCalculate(from, to) ?? 850m;
            var fromFormatted = !string.IsNullOrWhiteSpace(from) ? char.ToUpper(from.Trim()[0]) + from.Trim().Substring(1) : from;
            var toFormatted = !string.IsNullOrWhiteSpace(to) ? char.ToUpper(to.Trim()[0]) + to.Trim().Substring(1) : to;

            // Direct flight realistic cruise calculation (~780 km/h cruising + 30m buffer)
            int directDurationMinutes = (int)Math.Max(40, Math.Round(((double)distance / 780.0 * 60.0 + 30.0) / 5.0) * 5.0);
            string directDurationStr = FormatDurationMinutes(directDurationMinutes);

            // 1-Stop flight realistic connecting duration (~1h 45m layover + extra climb/descent)
            int connectingDurationMinutes = directDurationMinutes + 105;
            string connectingDurationStr = FormatDurationMinutes(connectingDurationMinutes);

            var schedules = new[]
            {
                new { Airline = "IndiGo", Prefix = "6E", FlightNumber = "6E-204", Dep = "06:00", Stops = 0, Seats = 180, Avail = 142 },
                new { Airline = "SpiceJet", Prefix = "SG", FlightNumber = "SG-8169", Dep = "08:15", Stops = 0, Seats = 189, Avail = 98 },
                new { Airline = "Air India", Prefix = "AI", FlightNumber = "AI-504", Dep = "11:30", Stops = 0, Seats = 168, Avail = 112 },
                new { Airline = "IndiGo", Prefix = "6E", FlightNumber = "6E-651", Dep = "14:00", Stops = 1, Seats = 180, Avail = 76 },
                new { Airline = "Vistara", Prefix = "UK", FlightNumber = "UK-833", Dep = "17:45", Stops = 0, Seats = 158, Avail = 54 },
                new { Airline = "SpiceJet", Prefix = "SG", FlightNumber = "SG-372", Dep = "20:30", Stops = 0, Seats = 189, Avail = 135 },
                new { Airline = "IndiGo", Prefix = "6E", FlightNumber = "6E-489", Dep = "22:15", Stops = 0, Seats = 180, Avail = 164 }
            };

            var newFlights = new List<Flight>();

            foreach (var s in schedules)
            {
                var depTime = TimeOnly.ParseExact(s.Dep, "HH:mm");
                int durMin = s.Stops == 0 ? directDurationMinutes : connectingDurationMinutes;
                int totalMin = depTime.Hour * 60 + depTime.Minute + durMin;
                int arrHour = (totalMin / 60) % 24;
                int arrMin = totalMin % 60;
                var arrTimeStr = $"{arrHour:D2}:{arrMin:D2}";
                var arrDate = totalMin >= 1440 ? date.AddDays(totalMin / 1440) : date;

                var fare = FlightFareCalculator.CalculateEconomyFare(distance, s.Dep, s.FlightNumber, s.Airline);
                if (s.Stops > 0)
                {
                    fare = Math.Round((fare * 0.92m) / 10m) * 10m;
                }

                newFlights.Add(new Flight
                {
                    FlightNumber = s.FlightNumber,
                    Airline = s.Airline,
                    FromCity = fromFormatted,
                    ToCity = toFormatted,
                    StopCount = s.Stops,
                    DepartureDate = date,
                    DepartureTime = s.Dep,
                    ArrivalDate = arrDate,
                    ArrivalTime = arrTimeStr,
                    Duration = s.Stops == 0 ? directDurationStr : connectingDurationStr,
                    DistanceKm = distance,
                    TotalSeats = s.Seats,
                    AvailableSeats = s.Avail,
                    Price = fare,
                    Status = "Scheduled",
                    BookingDate = localToday,
                    TripType = FlightTripTypes.OneWay
                });
            }

            _context.Flights.AddRange(newFlights);
            await _context.SaveChangesAsync();
            return newFlights;
        }
    }
}
