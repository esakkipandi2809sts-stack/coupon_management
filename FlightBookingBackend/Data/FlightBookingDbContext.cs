
using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Data
{
    public class FlightBookingDbContext : DbContext
    {
        public FlightBookingDbContext(
            DbContextOptions<FlightBookingDbContext> options)
            : base(options)
        {
        }

        // Existing database tables
        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Flight> Flights { get; set; } = null!;
        public DbSet<Booking> Bookings { get; set; } = null!;
        public DbSet<Coupon> Coupons { get; set; } = null!;
        public DbSet<CouponUsage> CouponUsages { get; set; } = null!;
        public DbSet<CouponTransaction> CouponTransactions { get; set; } = null!;

        // Coupon percentage rules table
        public DbSet<CouponPercentageRule> CouponPercentageRules
        {
            get;
            set;
        } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Coupon percentage rules configuration
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

                entity.HasIndex(x => new
                {
                    x.AirlineName,
                    x.CabinClass
                }).IsUnique();
            });
        }
    }
}
