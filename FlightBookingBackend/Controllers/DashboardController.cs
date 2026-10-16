using System.Security.Claims;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlightBookingBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(IDashboardService dashboardService, ILogger<DashboardController> logger)
        {
            _dashboardService = dashboardService;
            _logger = logger;
        }

        [Authorize]
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdClaim, out var userId))
                {
                    return Unauthorized(new { message = "Invalid user context." });
                }

                var stats = await _dashboardService.GetDashboardStatisticsAsync(userId);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving dashboard statistics");
                return StatusCode(500, new { message = "Error loading dashboard statistics." });
            }
        }

        [Authorize]
        [HttpGet("booking-statistics")]
        public async Task<IActionResult> GetBookingStatistics()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdClaim, out var userId))
                {
                    return Unauthorized(new { message = "Invalid user context." });
                }

                var stats = await _dashboardService.GetBookingStatisticsAsync(userId, User.IsInRole("Admin"));
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving booking statistics");
                return StatusCode(500, new { message = "Error loading booking statistics." });
            }
        }

        [HttpGet("recent-bookings")]
        public async Task<IActionResult> GetRecentBookings([FromQuery] int count = 10)
        {
            try
            {
                var bookings = await _dashboardService.GetRecentBookingsAsync(count);
                return Ok(bookings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recent bookings");
                return StatusCode(500, new { message = "Error loading recent bookings." });
            }
        }
    }
}
