using FlightBookingBackend.Data;
using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Controllers;

[ApiController]
[Route("api/coupon-percentage-rules")]
public class CouponPercentageRulesController : ControllerBase
{
    private readonly FlightBookingDbContext _context;
    private readonly CouponCalculationService _calculationService;

    public CouponPercentageRulesController(
        FlightBookingDbContext context,
        CouponCalculationService calculationService)
    {
        _context = context;
        _calculationService = calculationService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rules = await _context.CouponPercentageRules
            .AsNoTracking()
            .OrderBy(x => x.AirlineName)
            .ThenBy(x => x.CabinClass)
            .ToListAsync();

        return Ok(rules);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var rule = await _context.CouponPercentageRules
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (rule == null)
            return NotFound(new { message = "Coupon rule not found." });

        return Ok(rule);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CouponPercentageRuleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AirlineName) ||
            string.IsNullOrWhiteSpace(request.CabinClass))
        {
            return BadRequest(new
            {
                message = "Airline name and cabin class are required."
            });
        }

        if (!IsValidPercentage(request.Percentage))
        {
            return BadRequest(new
            {
                message = "Percentage must be between 0 and 100."
            });
        }

        var airline = request.AirlineName.Trim();
        var cabin = request.CabinClass.Trim();

        var duplicate = await _context.CouponPercentageRules
            .AnyAsync(x =>
                x.AirlineName.ToLower() == airline.ToLower() &&
                x.CabinClass.ToLower() == cabin.ToLower());

        if (duplicate)
        {
            return Conflict(new
            {
                message = "A rule already exists for this airline and class."
            });
        }

        var rule = new CouponPercentageRule
        {
            AirlineName = airline,
            CabinClass = cabin,
            Percentage = request.Percentage,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _context.CouponPercentageRules.Add(rule);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = rule.Id }, rule);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] CouponPercentageRuleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AirlineName) ||
            string.IsNullOrWhiteSpace(request.CabinClass))
        {
            return BadRequest(new
            {
                message = "Airline name and cabin class are required."
            });
        }

        if (!IsValidPercentage(request.Percentage))
        {
            return BadRequest(new
            {
                message = "Percentage must be between 0 and 100."
            });
        }

        var rule = await _context.CouponPercentageRules
            .FirstOrDefaultAsync(x => x.Id == id);

        if (rule == null)
            return NotFound(new { message = "Coupon rule not found." });

        var airline = request.AirlineName.Trim();
        var cabin = request.CabinClass.Trim();

        var duplicate = await _context.CouponPercentageRules
            .AnyAsync(x =>
                x.Id != id &&
                x.AirlineName.ToLower() == airline.ToLower() &&
                x.CabinClass.ToLower() == cabin.ToLower());

        if (duplicate)
        {
            return Conflict(new
            {
                message = "Another rule already exists for this airline and class."
            });
        }

        rule.AirlineName = airline;
        rule.CabinClass = cabin;
        rule.Percentage = request.Percentage;
        rule.IsActive = request.IsActive;
        rule.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(rule);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var rule = await _context.CouponPercentageRules
            .FirstOrDefaultAsync(x => x.Id == id);

        if (rule == null)
            return NotFound(new { message = "Coupon rule not found." });

        _context.CouponPercentageRules.Remove(rule);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Coupon rule deleted successfully." });
    }

    [HttpPost("calculate")]
    public async Task<IActionResult> Calculate(
        [FromBody] CouponCalculationRequest request)
    {
        try
        {
            var result = await _calculationService.CalculateAsync(
                request.BookingFare,
                request.AirlineName,
                request.CabinClass);

            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private static bool IsValidPercentage(decimal percentage) =>
        percentage >= 0 && percentage <= 100;
}

public class CouponPercentageRuleRequest
{
    public string AirlineName { get; set; } = string.Empty;
    public string CabinClass { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CouponCalculationRequest
{
    public decimal BookingFare { get; set; }
    public string AirlineName { get; set; } = string.Empty;
    public string CabinClass { get; set; } = string.Empty;
}