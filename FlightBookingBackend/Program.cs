
using System.Security.Claims;
using System.Text;
using FlightBookingBackend.Data;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Configure SQL Server Database
var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is missing from configuration.");
}

builder.Services.AddDbContext<FlightBookingDbContext>(options =>
    options.UseSqlServer(connectionString));

// 2. Register Application Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IFlightService, FlightService>();
builder.Services.AddScoped<ICouponService, CouponService>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHostedService<CouponStatusBackgroundService>();

// Register the coupon percentage calculation service.
// This service must use FlightBookingDbContext.
builder.Services.AddScoped<CouponCalculationService>();

// 3. Configure JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"];

if (string.IsNullOrWhiteSpace(jwtKey) ||
    Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Configure Jwt:Key with a secret of at least 32 bytes " +
        "using user-secrets or the deployment secret manager.");
}

var jwtIssuer =
    builder.Configuration["Jwt:Issuer"] ?? "FlightBookingAPI";

var jwtAudience =
    builder.Configuration["Jwt:Audience"] ?? "FlightBookingApp";

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            JwtBearerDefaults.AuthenticationScheme;

        options.DefaultChallengeScheme =
            JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,

                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtKey)),

                RoleClaimType = ClaimTypes.Role,

                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            };
    });

builder.Services.AddAuthorization();

// 4. Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAllOrigins", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// 5. Register Controllers and JSON Configuration
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;

        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// 6. Configure Swagger / OpenAPI with JWT Bearer support
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Flight Ticket Booking Management API",
        Version = "v1",
        Description =
            "Flight Ticket Booking and Coupon Management API"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description =
            "JWT Authorization header. Example: Bearer {token}",

        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// 7. Build the Application
var app = builder.Build();

// 8. Initialize the Existing Database
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;

    try
    {
        var context =
            services.GetRequiredService<FlightBookingDbContext>();

        DbInitializer.Initialize(context);
    }
    catch (Exception ex)
    {
        var logger =
            services.GetRequiredService<ILogger<Program>>();

        logger.LogCritical(
            ex,
            "Database initialization failed.");

        throw;
    }
}

// 9. Configure HTTP Request Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();

    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint(
            "/swagger/v1/swagger.json",
            "Flight Booking API v1");
    });
}

app.UseCors("AllowAllOrigins");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
