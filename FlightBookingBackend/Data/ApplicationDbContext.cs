
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<CouponPercentageRule> CouponPercentageRules =>
        Set<CouponPercentageRule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<CouponPercentageRule>(entity =>
        {
            entity.ToTable("CouponPercentageRules");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.AirlineName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.CabinClass)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Percentage)
                .HasPrecision(5, 2)
                .IsRequired();

            entity.Property(x => x.IsActive)
                .HasDefaultValue(true);

            entity.Property(x => x.CreatedAt)
                .HasDefaultValueSql("SYSUTCDATETIME()");

            entity.HasIndex(x => new { x.AirlineName, x.CabinClass })
                .IsUnique();
        });
    }
}
