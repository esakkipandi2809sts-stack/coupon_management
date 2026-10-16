using FlightBookingBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Data
{
    public class FlightBookingDbContext : DbContext
    {
        public FlightBookingDbContext(DbContextOptions<FlightBookingDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Flight> Flights { get; set; } = null!;
        public DbSet<Booking> Bookings { get; set; } = null!;
        public DbSet<Coupon> Coupons { get; set; } = null!;
        public DbSet<CouponUsage> CouponUsages { get; set; } = null!;
        public DbSet<CouponTransaction> CouponTransactions { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.Email).IsUnique();
                entity.HasIndex(e => e.Username).IsUnique();
                entity.Property(e => e.Role).HasDefaultValue("User");
                entity.ToTable(table => table.HasCheckConstraint(
                    "CK_Users_Role", "[Role] IN ('Admin', 'User')"));
            });

            // Flight configuration
            modelBuilder.Entity<Flight>(entity =>
            {
                entity.HasKey(e => e.FlightId);
                entity.HasIndex(e => new { e.FromCity, e.ToCity, e.DepartureDate });
                entity.Property(e => e.FromAirportCode).IsUnicode(false).HasMaxLength(3);
                entity.Property(e => e.ToAirportCode).IsUnicode(false).HasMaxLength(3);
                entity.Property(e => e.CreatedByUserName).HasMaxLength(150);
                entity.Property(e => e.TripType).HasMaxLength(20).HasDefaultValue("OneWay");
                entity.HasIndex(e => e.ItineraryId)
                    .HasFilter("[ItineraryId] IS NOT NULL")
                    .HasDatabaseName("IX_Flights_ItineraryId");
                entity.HasIndex(e => new { e.ItineraryId, e.SegmentOrder })
                    .IsUnique()
                    .HasFilter("[ItineraryId] IS NOT NULL")
                    .HasDatabaseName("UX_Flights_Itinerary_Segment");
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_Flights_StopCount", "[StopCount] IS NULL OR [StopCount] BETWEEN 0 AND 99");
                    table.HasCheckConstraint(
                        "CK_Flights_TripType", "[TripType] IN ('OneWay', 'RoundTrip', 'MultiCity')");
                });
            });

            // Coupon configuration
            modelBuilder.Entity<Coupon>(entity =>
            {
                entity.HasKey(e => e.CouponId);
                entity.Property(e => e.CouponCode).IsUnicode(false).HasMaxLength(8).IsRequired();
                entity.Property(e => e.LegacyCouponCode).HasMaxLength(50);
                entity.HasIndex(e => e.CouponCode)
                    .IsUnique()
                    .HasDatabaseName("UX_Coupons_CouponCode");
                entity.HasIndex(e => e.GeneratedForBookingId)
                    .IsUnique()
                    .HasFilter("[GeneratedForBookingId] IS NOT NULL");
                entity.HasIndex(e => new { e.Status, e.AvailableFromDate });
                entity.HasOne<User>()
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.GeneratedForBooking)
                    .WithOne(booking => booking.GeneratedCoupon)
                    .HasForeignKey<Coupon>(e => e.GeneratedForBookingId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // Booking configuration
            modelBuilder.Entity<Booking>(entity =>
            {
                entity.HasKey(e => e.BookingId);
                entity.HasIndex(e => e.BookingReference).IsUnique();
                entity.HasIndex(e => new { e.UserId, e.BookingStatus })
                    .HasDatabaseName("IX_Bookings_UserId_BookingStatus");
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint(
                        "CK_Bookings_BookingStatus",
                        "[BookingStatus] IN ('Confirmed', 'Pending', 'Cancelled', 'Rescheduled', 'Failed')");
                });
                entity.HasIndex(e => new { e.UserId, e.IdempotencyKey })
                    .IsUnique()
                    .HasFilter("[IdempotencyKey] IS NOT NULL")
                    .HasDatabaseName("UX_Bookings_User_IdempotencyKey");

                entity.HasOne(d => d.User)
                    .WithMany(p => p.Bookings)
                    .HasForeignKey(d => d.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Flight)
                    .WithMany(p => p.Bookings)
                    .HasForeignKey(d => d.FlightId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            // CouponUsage configuration
            modelBuilder.Entity<CouponUsage>(entity =>
            {
                entity.HasKey(e => e.CouponUsageId);
                entity.HasIndex(e => e.CouponId).IsUnique();

                entity.HasOne(d => d.Coupon)
                    .WithMany(p => p.CouponUsages)
                    .HasForeignKey(d => d.CouponId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.User)
                    .WithMany(p => p.CouponUsages)
                    .HasForeignKey(d => d.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Booking)
                    .WithMany(p => p.CouponUsages)
                    .HasForeignKey(d => d.BookingId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<CouponTransaction>(entity =>
            {
                entity.HasKey(e => e.CouponTransactionId);
                entity.HasIndex(e => new { e.BookingId, e.TransactionType })
                    .IsUnique()
                    .HasDatabaseName("UX_CouponTransactions_Booking_Type");
                entity.HasIndex(e => new { e.UserId, e.Status, e.TransactionType })
                    .HasDatabaseName("IX_CouponTransactions_User_Status_Type");
                entity.HasOne<User>()
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.Booking)
                    .WithMany(booking => booking.CouponTransactions)
                    .HasForeignKey(e => e.BookingId)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.ToTable(table =>
                {
                    table.HasCheckConstraint("CK_CouponTransactions_Points", "[Points] > 0");
                    table.HasCheckConstraint("CK_CouponTransactions_DiscountAmount", "[DiscountAmount] >= 0");
                    table.HasCheckConstraint(
                        "CK_CouponTransactions_Type", "[TransactionType] IN ('Earned', 'Redeemed')");
                    table.HasCheckConstraint(
                        "CK_CouponTransactions_Status", "[Status] IN ('Available', 'Pending', 'Redeemed', 'Cancelled')");
                });
            });
        }
    }
}
