using FlightBookingBackend.DTOs;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Mvc;

namespace FlightBookingBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthService _authService, ILogger<AuthController> logger)
        {
            this._authService = _authService;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var (success, message, response) = await _authService.RegisterAsync(dto);
                if (!success)
                {
                    return BadRequest(new { message });
                }

                return Ok(new
                {
                    message = "Registration successful. Please login.",
                    data = response
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during registration");
                return StatusCode(500, new { message = "An internal error occurred during registration. Please try again." });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var (success, message, response) = await _authService.LoginAsync(dto);
                if (!success)
                {
                    return Unauthorized(new { message });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during login");
                return StatusCode(500, new { message = "An internal error occurred during login. Please try again." });
            }
        }
    }
}
