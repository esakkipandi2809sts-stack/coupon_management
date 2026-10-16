using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using FlightBookingBackend.Controllers;
using FlightBookingBackend.Data;
using FlightBookingBackend.DTOs;
using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace FlightBookingBackend.Tests;

public class AuthRoleTests
{
    [Fact]
    public async Task RegistrationAlwaysCreatesAUserRole()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();

        var service = CreateAuthService(context);
        var result = await service.RegisterAsync(new RegisterDto
        {
            FullName = "New User",
            Email = "new.user@example.test",
            PhoneNumber = "555-0101",
            Password = "Password123!",
            ConfirmPassword = "Password123!"
        });

        Assert.True(result.Success);
        Assert.Equal("User", result.Response?.User.Role);
        Assert.Equal("User", (await context.Users.SingleAsync()).Role);
    }

    [Fact]
    public async Task LoginIssuesTheStoredAdministratorRoleInUserDtoAndJwt()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<FlightBookingDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new FlightBookingDbContext(options);
        await context.Database.EnsureCreatedAsync();
        context.Users.Add(new User
        {
            FullName = "Flight Admin",
            Username = "admin",
            Email = "admin@example.test",
            PhoneNumber = "555-0102",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            Role = "Admin",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        });
        await context.SaveChangesAsync();

        var result = await CreateAuthService(context).LoginAsync(new LoginDto
        {
            Username = "admin",
            Password = "Password123!"
        });

        Assert.True(result.Success);
        Assert.Equal("Admin", result.Response?.User.Role);
        var token = new JwtSecurityTokenHandler().ReadJwtToken(result.Response!.Token);
        Assert.Contains(token.Claims, claim => claim.Type == ClaimTypes.Role && claim.Value == "Admin");
    }

    [Fact]
    public async Task PasswordCanBeChangedOnlyAfterVerifyingCurrentPasswordAndIsRehashed()
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
            FullName = "Password Test",
            Username = "password-test",
            Email = "password-test@example.test",
            PhoneNumber = "555-0104",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Old_Strong_Pass!2026"),
            Role = "User",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = CreateAuthService(context);
        var failed = await service.ChangePasswordAsync(user.Id, new ChangePasswordDto
        {
            CurrentPassword = "wrong-password",
            NewPassword = "New_Strong_Pass!2026"
        });
        Assert.False(failed.Success);

        var changed = await service.ChangePasswordAsync(user.Id, new ChangePasswordDto
        {
            CurrentPassword = "Old_Strong_Pass!2026",
            NewPassword = "New_Strong_Pass!2026"
        });
        Assert.True(changed.Success);
        var savedHash = (await context.Users.SingleAsync()).PasswordHash;
        Assert.True(BCrypt.Net.BCrypt.Verify("New_Strong_Pass!2026", savedHash));
        Assert.False(BCrypt.Net.BCrypt.Verify("Old_Strong_Pass!2026", savedHash));
    }

    [Fact]
    public void FlightListingAndCreationRequireAuthenticationButCreationDoesNotRequireAdminRole()
    {
        var controllerAuthorization = typeof(FlightsController)
            .GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(controllerAuthorization);
        Assert.Null(controllerAuthorization!.Roles);

        var createAuthorization = typeof(FlightsController)
            .GetMethod(nameof(FlightsController.CreateFlight))!
            .GetCustomAttribute<AuthorizeAttribute>();
        Assert.Null(createAuthorization);
        AssertAdminOnly(nameof(FlightsController.UpdateFlight));
        AssertAdminOnly(nameof(FlightsController.DeleteFlight));
    }

    [Fact]
    public async Task AdminCouponListingIncludesAllOwnersAndCorrectAggregateCounts()
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
            FullName = "Coupon Owner",
            Username = "coupon-owner",
            Email = "coupon-owner@example.test",
            PhoneNumber = "555-0103",
            PasswordHash = "bcrypt-hash",
            Role = "User",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        context.Coupons.AddRange(
            CreateCoupon("ADMIN-AVAILABLE", user.Id, "Available"),
            CreateCoupon("ADMIN-PENDING", user.Id, "Pending"));
        await context.SaveChangesAsync();

        var couponService = new CouponService(context);
        var coupons = (await couponService.GetAllCouponsForAdminAsync()).ToList();
        var summary = await couponService.GetCouponStatisticsForAdminAsync();

        Assert.Equal(2, coupons.Count);
        Assert.All(coupons, coupon => Assert.Equal("coupon-owner", coupon.OwnerUsername));
        Assert.Equal(2, summary.TotalCoupons);
        Assert.Equal(1, summary.AvailableCoupons);
        Assert.Equal(1, summary.PendingCoupons);
        Assert.Equal(0, summary.UsedCoupons);
        Assert.Equal(0, summary.ExpiredCoupons);
    }

    [Fact]
    public void AdminCouponOverviewEndpointsAreAdminOnly()
    {
        AssertAdminOnly(typeof(CouponsController), nameof(CouponsController.GetAllCouponsForAdmin));
        AssertAdminOnly(typeof(CouponsController), nameof(CouponsController.GetAdminCouponSummary));
    }

    private static void AssertAdminOnly(string actionName)
    {
        AssertAdminOnly(typeof(FlightsController), actionName);
    }

    private static void AssertAdminOnly(Type controllerType, string actionName)
    {
        var authorization = controllerType
            .GetMethod(actionName)!
            .GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authorization);
        Assert.Equal("Admin", authorization!.Roles);
    }

    private static Coupon CreateCoupon(string code, int userId, string status) => new()
    {
        CouponCode = code,
        Description = "Admin dashboard test coupon",
        DiscountType = "Fixed",
        DiscountValue = 200m,
        DiscountAmount = 200m,
        ExpiryDate = DateTime.UtcNow.AddDays(10),
        TotalUsageLimit = 1,
        UsedCount = 0,
        Status = status,
        UserId = userId,
        CreatedAt = DateTime.UtcNow
    };

    private static AuthService CreateAuthService(FlightBookingDbContext context)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "Test_JWT_Key_Must_Be_At_Least_Thirty_Two_Bytes!",
                ["Jwt:Issuer"] = "FlightBookingAPI",
                ["Jwt:Audience"] = "FlightBookingApp"
            })
            .Build();

        return new AuthService(context, configuration);
    }
}
