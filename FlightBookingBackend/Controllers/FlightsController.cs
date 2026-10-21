using FlightBookingBackend.DTOs;
using System.Security.Claims;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace FlightBookingBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FlightsController : ControllerBase
    {
        private readonly IFlightService _flightService;
        private readonly ILogger<FlightsController> _logger;
        private readonly TimeProvider _timeProvider;
        private readonly TimeZoneInfo _businessTimeZone;

        public FlightsController(
            IFlightService flightService,
            ILogger<FlightsController> logger,
            TimeProvider timeProvider,
            IConfiguration configuration)
        {
            _flightService = flightService;
            _logger = logger;
            _timeProvider = timeProvider;
            var timeZoneId = configuration["Coupons:BusinessTimeZoneId"] ?? "Asia/Kolkata";
            _businessTimeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllFlights()
        {
            try
            {
                var flights = await _flightService.GetAllFlightsAsync();
                return Ok(flights);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving flights");
                return StatusCode(500, new { message = "Error retrieving flights." });
            }
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchFlights([FromQuery] FlightSearchQueryDto query)
        {
            if (string.IsNullOrWhiteSpace(query.FromCity) ||
                string.IsNullOrWhiteSpace(query.ToCity) ||
                !query.DepartureDate.HasValue)
            {
                return BadRequest(new
                {
                    message = "fromCity, toCity, and departureDate are required."
                });
            }
            if (query.FromCity.Trim().Equals(query.ToCity.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Origin and destination must be different." });
            }
            if (query.Adults < 1 || query.Children < 0 || query.Infants < 0 ||
                query.Adults + query.Children + query.Infants > 27)
            {
                return BadRequest(new { message = "Select at least one adult and no more than 27 passengers." });
            }
            var localNow = TimeZoneInfo.ConvertTime(_timeProvider.GetUtcNow(), _businessTimeZone);
            if (query.DepartureDate.Value < DateOnly.FromDateTime(localNow.DateTime))
            {
                return BadRequest(new { message = "Departure date must be today or later." });
            }

            try
            {
                var flights = await _flightService.SearchFlightsAsync(query);
                return Ok(flights);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching flights");
                return StatusCode(500, new { message = "Error searching flights." });
            }
        }

        [HttpGet("search-options")]
        public async Task<IActionResult> GetSearchOptions()
        {
            try
            {
                return Ok(await _flightService.GetSearchOptionsAsync());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving flight search options");
                return StatusCode(500, new { message = "Error retrieving flight search options." });
            }
        }

        [HttpGet("route")]
        public async Task<IActionResult> GetFlightsByRoute(
            [FromQuery] string fromCity,
            [FromQuery] string toCity)
        {
            if (string.IsNullOrWhiteSpace(fromCity) || string.IsNullOrWhiteSpace(toCity))
            {
                return BadRequest(new { message = "fromCity and toCity are required." });
            }

            try
            {
                var flights = await _flightService.GetFlightsByRouteAsync(fromCity, toCity);
                return Ok(flights);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving flights for route {FromCity} to {ToCity}", fromCity, toCity);
                return StatusCode(500, new { message = "Error retrieving flights for this route." });
            }
        }

        [HttpGet("search/{from}/{to}/{date}")]
        public async Task<IActionResult> SearchFlightsByRoute(string from, string to, string date)
        {
            try
            {
                if (!DateOnly.TryParse(date, out var parsedDate))
                {
                    return BadRequest(new { message = "Invalid date format. Expected YYYY-MM-DD." });
                }

                var flights = await _flightService.SearchFlightsByRouteAsync(from, to, parsedDate);
                return Ok(flights);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching flights by route");
                return StatusCode(500, new { message = "Error searching flights." });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetFlightById(int id)
        {
            try
            {
                var flight = await _flightService.GetFlightByIdAsync(id);
                if (flight == null)
                {
                    return NotFound(new { message = $"Flight with ID {id} not found." });
                }

                return Ok(flight);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving flight by id {Id}", id);
                return StatusCode(500, new { message = "Error retrieving flight details." });
            }
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteFlight(int id)
        {
            try
            {
                var deleted = await _flightService.DeleteFlightAsync(id);
                if (!deleted)
                {
                    return NotFound(new { message = $"Flight with ID {id} not found." });
                }

                return Ok(new { message = "Flight deleted successfully!" });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "Cannot delete flight {Id} because related records exist", id);
                return Conflict(new
                {
                    message = "This flight cannot be deleted because it has associated bookings."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting flight {Id}", id);
                return StatusCode(500, new { message = "Error deleting flight." });
            }
        }

        [HttpGet("cities")]
        public async Task<IActionResult> GetCities()
        {
            try
            {
                var cities = await _flightService.GetUniqueCitiesAsync();
                return Ok(cities);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving cities");
                return StatusCode(500, new { message = "Error retrieving cities." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateFlight([FromBody] CreateFlightDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Business-rule validations
            if (dto.TotalSeats <= 0)
                return BadRequest(new { message = "TotalSeats must be greater than zero." });

            if (dto.AvailableSeats < 0)
                return BadRequest(new { message = "AvailableSeats cannot be negative." });

            if (dto.AvailableSeats > dto.TotalSeats)
                return BadRequest(new { message = "AvailableSeats cannot exceed TotalSeats." });

            if (dto.DistanceKm <= 0)
                return BadRequest(new { message = "DistanceKm must be greater than zero." });

            if (dto.DepartureDate == default || dto.ArrivalDate == default)
                return BadRequest(new { message = "DepartureDate and ArrivalDate are required." });

            if (dto.ArrivalDate < dto.DepartureDate)
                return BadRequest(new { message = "ArrivalDate cannot be before DepartureDate." });

            if (string.Equals(dto.FromCity.Trim(), dto.ToCity.Trim(), StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "FromCity and ToCity must be different." });

            try
            {
                var creatorUserName = GetCurrentUserName();
                if (creatorUserName == null)
                    return Unauthorized(new { message = "Your login session does not contain a valid username. Please sign in again." });

                var created = await _flightService.CreateFlightAsync(dto, creatorUserName);
                return CreatedAtAction(nameof(GetFlightById), new { id = created.FlightId }, created);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating flight");
                return StatusCode(500, new { message = "Error creating flight." });
            }
        }

        /// <summary>
        /// Creates a One Way (1 segment), Round Trip (2 segments) or Multi-City (2-6 segments) itinerary.
        /// All segments are saved in one database transaction, each as its own Flights row, sharing an ItineraryId.
        /// </summary>
        [HttpPost("itinerary")]
        public async Task<IActionResult> CreateItinerary([FromBody] CreateItineraryDto request)
        {
            if (!ModelState.IsValid)
            {
                var firstError = ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)
                    .FirstOrDefault(m => !string.IsNullOrWhiteSpace(m));
                return BadRequest(new
                {
                    message = firstError ?? "The flight details are invalid.",
                    errors = ModelState.Where(e => e.Value?.Errors.Count > 0)
                        .ToDictionary(e => e.Key, e => e.Value!.Errors.Select(x => x.ErrorMessage).ToArray())
                });
            }

            var creatorUserName = GetCurrentUserName();
            if (creatorUserName == null)
                return Unauthorized(new { message = "Your login session does not contain a valid username. Please sign in again." });

            try
            {
                var result = await _flightService.CreateItineraryAsync(request, creatorUserName);
                var firstFlightId = result.Flights[0].FlightId;
                return CreatedAtAction(nameof(GetFlightById), new { id = firstFlightId }, result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Database error while creating itinerary");
                return StatusCode(500, new { message = "The itinerary could not be saved. No flights were created." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating itinerary");
                return StatusCode(500, new { message = "Error creating flights. No flights were created." });
            }
        }

        // Full name comes from the JWT (ClaimTypes.Name). Falls back to username/email if name is missing.
        private string? GetCurrentUserName()
        {
            var fullName = User.FindFirst(ClaimTypes.Name)?.Value;
            if (!string.IsNullOrWhiteSpace(fullName))
                return fullName.Trim();

            var username = User.FindFirst("username")?.Value ?? User.FindFirst(ClaimTypes.Email)?.Value;
            return string.IsNullOrWhiteSpace(username) ? null : username.Trim();
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateFlight(int id, [FromBody] CreateFlightDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (dto.TotalSeats <= 0 || dto.AvailableSeats < 0 || dto.AvailableSeats > dto.TotalSeats)
            {
                return BadRequest(new
                {
                    message = "Seat counts must be valid and available seats cannot exceed total seats."
                });
            }

            if (dto.DistanceKm <= 0)
                return BadRequest(new { message = "DistanceKm must be greater than zero." });

            if (dto.DepartureDate == default || dto.ArrivalDate == default)
                return BadRequest(new { message = "DepartureDate and ArrivalDate are required." });

            if (dto.ArrivalDate < dto.DepartureDate)
                return BadRequest(new { message = "ArrivalDate cannot be before DepartureDate." });

            if (string.Equals(dto.FromCity.Trim(), dto.ToCity.Trim(), StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "FromCity and ToCity must be different." });

            try
            {
                var updated = await _flightService.UpdateFlightAsync(id, dto);
                return updated == null
                    ? NotFound(new { message = $"Flight with ID {id} not found." })
                    : Ok(updated);
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating flight {Id}", id);
                return StatusCode(500, new { message = "Error updating flight." });
            }
        }
    }
}
