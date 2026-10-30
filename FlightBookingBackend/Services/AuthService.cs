using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace FlightBookingBackend.Services
{
    public class AuthService : IAuthService
    {
        private readonly FlightBookingDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthService(FlightBookingDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<(bool Success, string Message, AuthResponseDto? Response)> RegisterAsync(RegisterDto dto)
        {
            var normalizedEmail = dto.Email.Trim().ToLower();

            var existingUser = await _context.Users.AnyAsync(u =>
                u.Email.ToLower() == normalizedEmail || u.Username.ToLower() == normalizedEmail);
            if (existingUser)
            {
                return (false, "A user with this email address already exists.", null);
            }

            var user = new User
            {
                FullName = dto.FullName.Trim(),
                Username = normalizedEmail,
                Email = normalizedEmail,
                PhoneNumber = dto.PhoneNumber.Trim(),
                PasswordHash = dto.Password,
                Role = "User",
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var role = NormalizeRole(user.Role);
            var token = GenerateJwtToken(user.Id, user.Email, user.FullName, role, user.Username);
            var userDto = new UserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Username = user.Username,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Role = role,
                CreatedAt = user.CreatedAt,
                IsActive = user.IsActive
            };

            return (true, "Registration successful. Please login.", new AuthResponseDto
            {
                Token = token,
                User = userDto,
                Message = "Registration successful."
            });
        }

        public async Task<(bool Success, string Message, AuthResponseDto? Response)> LoginAsync(LoginDto dto)
        {
            var identifier = string.IsNullOrWhiteSpace(dto.Username) ? dto.Email : dto.Username;
            var normalizedUsername = identifier.Trim().ToLowerInvariant();
            if (normalizedUsername.Length == 0 || string.IsNullOrWhiteSpace(dto.Password))
            {
                return (false, "Username and password are required.", null);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u =>
                u.Username.ToLower() == normalizedUsername || u.Email.ToLower() == normalizedUsername);
            if (user == null)
            {
                return (false, "Invalid email or password", null);
            }

            if (!user.IsActive)
            {
                return (false, "Account is disabled. Please contact support.", null);
            }

            bool isPasswordValid = false;
            if (string.Equals(user.PasswordHash, dto.Password, StringComparison.Ordinal))
            {
                isPasswordValid = true;
            }
            else
            {
                try
                {
                    isPasswordValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
                }
                catch
                {
                    isPasswordValid = false;
                }
            }

            if (!isPasswordValid)
            {
                return (false, "Invalid email or password", null);
            }

            var role = NormalizeRole(user.Role);
            var token = GenerateJwtToken(user.Id, user.Email, user.FullName, role, user.Username);
            var userDto = new UserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Username = user.Username,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Role = role,
                CreatedAt = user.CreatedAt,
                IsActive = user.IsActive
            };

            return (true, "Login successful", new AuthResponseDto
            {
                Token = token,
                User = userDto,
                Message = "Login successful"
            });
        }

        public async Task<UserDto?> GetUserProfileAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            return new UserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Username = user.Username,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Role = NormalizeRole(user.Role),
                CreatedAt = user.CreatedAt,
                IsActive = user.IsActive
            };
        }

        public async Task<(bool Success, string Message, UserDto? User)> UpdateUserProfileAsync(int userId, UpdateProfileDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return (false, "User not found", null);

            user.FullName = dto.FullName.Trim();
            user.PhoneNumber = dto.PhoneNumber.Trim();

            await _context.SaveChangesAsync();

            return (true, "Profile updated successfully", new UserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Username = user.Username,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                Role = NormalizeRole(user.Role),
                CreatedAt = user.CreatedAt,
                IsActive = user.IsActive
            });
        }

        public async Task<(bool Success, string Message)> ChangePasswordAsync(int userId, ChangePasswordDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return (false, "User not found.");
            }

            bool isCurrentValid = false;
            if (string.Equals(user.PasswordHash, dto.CurrentPassword, StringComparison.Ordinal))
            {
                isCurrentValid = true;
            }
            else
            {
                try
                {
                    isCurrentValid = BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash);
                }
                catch
                {
                    isCurrentValid = false;
                }
            }

            if (!isCurrentValid)
            {
                return (false, "Current password is incorrect.");
            }

            if (!IsSecurePassword(dto.NewPassword))
            {
                return (false, "New password must be at least 12 characters and include uppercase, lowercase, a digit, and a symbol.");
            }

            if (string.Equals(user.PasswordHash, dto.NewPassword, StringComparison.Ordinal))
            {
                return (false, "New password must differ from the current password.");
            }

            user.PasswordHash = dto.NewPassword;
            await _context.SaveChangesAsync();
            return (true, "Password changed successfully.");
        }

        public string GenerateJwtToken(int userId, string email, string fullName, string role, string? username = null)
        {
            var jwtSecret = _configuration["Jwt:Key"]
                ?? throw new InvalidOperationException("Jwt:Key must be configured before issuing authentication tokens.");
            var issuer = _configuration["Jwt:Issuer"] ?? "FlightBookingAPI";
            var audience = _configuration["Jwt:Audience"] ?? "FlightBookingApp";
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Name, fullName),
                new Claim(ClaimTypes.Role, role),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };
            // Login name used as the flight creator; the flight table stores this string only.
            if (!string.IsNullOrWhiteSpace(username))
            {
                claims.Add(new Claim("username", username));
            }

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static string NormalizeRole(string? role)
        {
            return string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase)
                ? "Admin"
                : "User";
        }

        private static bool IsSecurePassword(string password)
        {
            return password.Length >= 12 &&
                   password.Any(char.IsUpper) &&
                   password.Any(char.IsLower) &&
                   password.Any(char.IsDigit) &&
                   password.Any(character => !char.IsLetterOrDigit(character));
        }
    }
}
