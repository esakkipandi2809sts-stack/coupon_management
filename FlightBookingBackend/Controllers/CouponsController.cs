using System.Security.Claims;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlightBookingBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CouponsController : ControllerBase
    {
        private readonly ICouponService _couponService;
        private readonly ILogger<CouponsController> _logger;

        public CouponsController(ICouponService couponService, ILogger<CouponsController> logger)
        {
            _couponService = couponService;
            _logger = logger;
        }

        [Authorize]
        [HttpGet]
        [HttpGet("my-coupons")]
        public async Task<IActionResult> GetAllCoupons()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Invalid user context." });
            }

            try
            {
                var coupons = await _couponService.GetAllCouponsAsync(userId);
                return Ok(coupons);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching coupons");
                return StatusCode(500, new { message = "Error fetching coupons." });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("admin")]
        public async Task<IActionResult> GetAllCouponsForAdmin()
        {
            try
            {
                return Ok(await _couponService.GetAllCouponsForAdminAsync());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching coupons for administrator");
                return StatusCode(500, new { message = "Error fetching coupon administration data." });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("admin/summary")]
        public async Task<IActionResult> GetAdminCouponSummary()
        {
            try
            {
                return Ok(await _couponService.GetCouponStatisticsForAdminAsync());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching administrator coupon summary");
                return StatusCode(500, new { message = "Error calculating coupon administration summary." });
            }
        }

        [Authorize]
        [HttpGet("available")]
        public async Task<IActionResult> GetAvailableCoupons()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Invalid user context." });
            }

            try
            {
                var coupons = await _couponService.GetAllCouponsAsync(userId);
                return Ok(coupons.Where(coupon =>
                    string.Equals(coupon.Status, "Available", StringComparison.OrdinalIgnoreCase)));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching available coupons for user {UserId}", userId);
                return StatusCode(500, new { message = "Error fetching available coupons." });
            }
        }

        [Authorize]
        [HttpGet("eligibility")]
        public async Task<IActionResult> GetCouponEligibility()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Invalid user context." });
            }

            try
            {
                var eligibility = await _couponService.GetCouponEligibilityAsync(userId);
                return Ok(eligibility);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking coupon eligibility for user {UserId}", userId);
                return StatusCode(500, new { message = "Error checking coupon eligibility." });
            }
        }

        [Authorize]
        [HttpGet("balance")]
        public async Task<IActionResult> GetCouponBalance()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Invalid user context." });
            }

            try
            {
                return Ok(await _couponService.GetCouponBalanceAsync(userId));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching coupon point balance for user {UserId}", userId);
                return StatusCode(500, new { message = "Error fetching coupon point balance." });
            }
        }

        [Authorize]
        [HttpPost("validate")]
        public async Task<IActionResult> ValidateCoupon([FromBody] ValidateCouponRequestDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdClaim, out var userId))
                {
                    return Unauthorized(new { message = "Invalid user context." });
                }

                var result = await _couponService.ValidateCouponAsync(request.CouponCode, request.FlightId, request.Class, userId, request.PassengerCount);

                if (!result.IsValid)
                {
                    return BadRequest(result);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating coupon {Code}", request.CouponCode);
                return StatusCode(500, new { message = "Error validating coupon." });
            }
        }

        [Authorize]
        [HttpGet("statistics")]
        [HttpGet("summary")]
        public async Task<IActionResult> GetCouponStatistics()
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(userIdClaim, out var userId))
                {
                    return Unauthorized(new { message = "Invalid user context." });
                }

                var stats = await _couponService.GetCouponStatisticsAsync(userId);
                return Ok(stats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching coupon statistics");
                return StatusCode(500, new { message = "Error calculating coupon statistics." });
            }
        }
    }
}
