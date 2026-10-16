using FlightBookingBackend.DTOs;

namespace FlightBookingBackend.Services
{
    public interface IAuthService
    {
        Task<(bool Success, string Message, AuthResponseDto? Response)> RegisterAsync(RegisterDto dto);
        Task<(bool Success, string Message, AuthResponseDto? Response)> LoginAsync(LoginDto dto);
        Task<UserDto?> GetUserProfileAsync(int userId);
        Task<(bool Success, string Message, UserDto? User)> UpdateUserProfileAsync(int userId, UpdateProfileDto dto);
        Task<(bool Success, string Message)> ChangePasswordAsync(int userId, ChangePasswordDto dto);
        string GenerateJwtToken(int userId, string email, string fullName, string role, string? username = null);
    }
}
