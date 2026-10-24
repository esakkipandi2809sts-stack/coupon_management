using System.Security.Claims;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlightBookingBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;
        private readonly ILogger<BookingsController> _logger;

        public BookingsController(IBookingService bookingService, ILogger<BookingsController> logger)
        {
            _bookingService = bookingService;
            _logger = logger;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }
            throw new UnauthorizedAccessException("Invalid user context.");
        }

        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (dto.IdempotencyKey == Guid.Empty)
            {
                return BadRequest(new { message = "A valid booking request key is required." });
            }

            try
            {
                var userId = GetCurrentUserId();
                var (success, message, booking) = await _bookingService.CreateBookingAsync(userId, dto);

                if (!success)
                {
                    return BadRequest(new { message });
                }

                booking!.Message = message;
                return CreatedAtAction(nameof(GetBookingById), new { id = booking!.BookingId }, booking);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating booking");
                return StatusCode(500, new { message = "An error occurred while creating your booking." });
            }
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMyBookings()
        {
            try
            {
                var userId = GetCurrentUserId();
                var bookings = await _bookingService.GetUserBookingsAsync(userId);
                return Ok(bookings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user bookings");
                return StatusCode(500, new { message = "Error retrieving bookings." });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetBookingById(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var booking = await _bookingService.GetBookingByIdAsync(id, userId);

                if (booking == null)
                {
                    return NotFound(new { message = $"Booking #{id} not found." });
                }

                return Ok(booking);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving booking {Id}", id);
                return StatusCode(500, new { message = "Error retrieving booking details." });
            }
        }

        [HttpPut("{id:int}/cancel")]
        public async Task<IActionResult> CancelBooking(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = User.IsInRole("Admin");
                var (success, message) = await _bookingService.CancelBookingAsync(id, userId, isAdmin);

                if (!success)
                {
                    return BadRequest(new { message });
                }

                return Ok(new { message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling booking {Id}", id);
                return StatusCode(500, new { message = "Error cancelling booking." });
            }
        }

        [HttpPut("{id:int}/reschedule")]
        public async Task<IActionResult> RescheduleBooking(int id, [FromBody] RescheduleBookingDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userId = GetCurrentUserId();
                var (success, message, booking) = await _bookingService.RescheduleBookingAsync(id, userId, dto);

                if (!success)
                {
                    return BadRequest(new { message });
                }

                return Ok(new { message, booking });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rescheduling booking {Id}", id);
                return StatusCode(500, new { message = "Error rescheduling booking." });
            }
        }
    }
}
