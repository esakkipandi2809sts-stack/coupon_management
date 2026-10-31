using FlightBookingBackend.Models;
using FlightBookingBackend.Services;
using Microsoft.EntityFrameworkCore;

namespace FlightBookingBackend.Data
{
    public static class DbInitializer
    {
        public static void Initialize(FlightBookingDbContext context)
        {
            EnsureLegacySchemaUpgrade(context);
            BackfillMissingFlightDistances(context);
            FixExistingFlightFares(context);

            // 1. Seed demo users so the quick login flow works even when other users already exist.
            EnsureSeedUsers(context);

            // 2. Ensure every user has a UserCouponCount record and accurate counts in database.
            EnsureUserCouponCounts(context);

            // Flights are created through the authenticated flight management API.
        }

        private static void EnsureSeedUsers(FlightBookingDbContext context)
        {
            var demoUsers = new[]
            {
                new
                {
                    FullName = "John Doe",
                    Username = "john.doe@example.com",
                    Email = "john.doe@example.com",
                    PhoneNumber = "+1 555-0199",
                    Role = "User"
                },
                new
                {
                    FullName = "Sarah Connor",
                    Username = "sarah.c@example.com",
                    Email = "sarah.c@example.com",
                    PhoneNumber = "+1 555-0188",
                    Role = "User"
                },
                new
                {
                    FullName = "Alex Johnson",
                    Username = "alex.j@example.com",
                    Email = "alex.j@example.com",
                    PhoneNumber = "+1 555-0177",
                    Role = "User"
                }
            };

            var passwordHash = "Password123!";

            foreach (var seedUser in demoUsers)
            {
                var existingUser = context.Users.FirstOrDefault(u =>
                    u.Email.ToLower() == seedUser.Email.ToLower() ||
                    u.Username.ToLower() == seedUser.Username.ToLower());

                if (existingUser != null)
                {
                    existingUser.FullName = seedUser.FullName;
                    existingUser.Username = seedUser.Username;
                    existingUser.Email = seedUser.Email;
                    existingUser.PhoneNumber = seedUser.PhoneNumber;
                    existingUser.PasswordHash = passwordHash;
                    existingUser.Role = seedUser.Role;
                    existingUser.IsActive = true;
                    continue;
                }

                context.Users.Add(new User
                {
                    FullName = seedUser.FullName,
                    Username = seedUser.Username,
                    Email = seedUser.Email,
                    PhoneNumber = seedUser.PhoneNumber,
                    PasswordHash = passwordHash,
                    Role = seedUser.Role,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                });
            }

            if (context.ChangeTracker.HasChanges())
            {
                context.SaveChanges();
            }
        }

        /// <summary>
        /// Legacy flights saved before route distance existed have no DistanceKm, which made the
        /// distance-based fare resolve to Rs 0.00. Fill the distance from the supported city table
        /// (same formula as the Flight Management form) and recompute the stored economy fare.
        /// Flights whose cities are not in the table are left untouched.
        /// </summary>
        private static void BackfillMissingFlightDistances(FlightBookingDbContext context)
        {
            var flights = context.Flights
                .Where(f => f.DistanceKm == null || f.DistanceKm <= 0m)
                .ToList();

            var changed = false;
            foreach (var flight in flights)
            {
                var distance = RouteDistanceCalculator.TryCalculate(flight.FromCity, flight.ToCity);
                if (distance is null)
                {
                    continue;
                }

                flight.DistanceKm = distance.Value;
                flight.Price = FlightFareCalculator.CalculateEconomyFare(distance.Value);
                changed = true;
            }

            if (changed)
            {
                context.SaveChanges();
            }
        }

        private static void FixExistingFlightFares(FlightBookingDbContext context)
        {
            var flightsWithDistance = context.Flights
                .Where(f => f.DistanceKm != null && f.DistanceKm > 0m)
                .ToList();

            var changed = false;
            foreach (var flight in flightsWithDistance)
            {
                var expectedFare = FlightFareCalculator.CalculateEconomyFare(flight.DistanceKm!.Value);
                if (flight.Price != expectedFare)
                {
                    flight.Price = expectedFare;
                    changed = true;
                }
            }

            if (changed)
            {
                context.SaveChanges();
            }
        }

        private static void EnsureLegacySchemaUpgrade(FlightBookingDbContext context)
        {
            if (!context.Database.IsSqlServer())
            {
                return;
            }

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Flights', N'DistanceKm') IS NULL
    ALTER TABLE dbo.Flights ADD DistanceKm DECIMAL(10,2) NULL;
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Flights', N'StopCount') IS NULL
    ALTER TABLE dbo.Flights ADD StopCount INT NULL;
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Flights', N'BookingDate') IS NULL
    ALTER TABLE dbo.Flights ADD BookingDate DATE NULL
        CONSTRAINT DF_Flights_BookingDate DEFAULT CAST(GETDATE() AS DATE) WITH VALUES;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Flights_StopCount' AND parent_object_id = OBJECT_ID(N'dbo.Flights'))
    ALTER TABLE dbo.Flights ADD CONSTRAINT CK_Flights_StopCount
        CHECK (StopCount IS NULL OR StopCount BETWEEN 0 AND 99);
");

            // One Way / Round Trip / Multi-City support and username-only creator tracking.
            // Mirrors FlightBooking_DB/add_flight_itinerary_support.sql and is safe to run repeatedly.
            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Flights', N'CreatedByUserName') IS NULL
    ALTER TABLE dbo.Flights ADD CreatedByUserName NVARCHAR(150) NULL;
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Flights', N'TripType') IS NULL
    ALTER TABLE dbo.Flights ADD TripType NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Flights_TripType DEFAULT N'OneWay' WITH VALUES;
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Flights', N'ItineraryId') IS NULL
    ALTER TABLE dbo.Flights ADD ItineraryId UNIQUEIDENTIFIER NULL;
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Flights', N'SegmentOrder') IS NULL
    ALTER TABLE dbo.Flights ADD SegmentOrder INT NULL;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Flights_TripType' AND parent_object_id = OBJECT_ID(N'dbo.Flights'))
    ALTER TABLE dbo.Flights ADD CONSTRAINT CK_Flights_TripType
        CHECK (TripType IN (N'OneWay', N'RoundTrip', N'MultiCity'));
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Flights_ItineraryId' AND object_id = OBJECT_ID(N'dbo.Flights'))
    CREATE NONCLUSTERED INDEX IX_Flights_ItineraryId ON dbo.Flights (ItineraryId) WHERE ItineraryId IS NOT NULL;
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Flights_Itinerary_Segment' AND object_id = OBJECT_ID(N'dbo.Flights'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Flights_Itinerary_Segment ON dbo.Flights (ItineraryId, SegmentOrder) WHERE ItineraryId IS NOT NULL;
");

            // Booking status support: Confirmed | Pending | Cancelled | Rescheduled | Failed
            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bookings_UserId_BookingStatus' AND object_id = OBJECT_ID(N'dbo.Bookings'))
    CREATE NONCLUSTERED INDEX IX_Bookings_UserId_BookingStatus ON dbo.Bookings (UserId, BookingStatus);
");

            // Only added when every existing row already uses a supported status, so startup never fails on legacy data.
            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Bookings_BookingStatus' AND parent_object_id = OBJECT_ID(N'dbo.Bookings'))
   AND NOT EXISTS (SELECT 1 FROM dbo.Bookings WHERE BookingStatus NOT IN (N'Confirmed', N'Pending', N'Cancelled', N'Rescheduled', N'Failed'))
    ALTER TABLE dbo.Bookings ADD CONSTRAINT CK_Bookings_BookingStatus
        CHECK (BookingStatus IN (N'Confirmed', N'Pending', N'Cancelled', N'Rescheduled', N'Failed'));
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'Role') IS NULL
    ALTER TABLE dbo.Users ADD Role NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Users_Role DEFAULT N'User' WITH VALUES;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'Username') IS NULL
    ALTER TABLE dbo.Users ADD Username NVARCHAR(150) NOT NULL
        CONSTRAINT DF_Users_Username DEFAULT N'' WITH VALUES;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    UPDATE dbo.Users SET Username = LOWER(Email) WHERE Username = N'';
    UPDATE dbo.Users
    SET Role = CASE WHEN LOWER(Role) = N'admin' THEN N'Admin' ELSE N'User' END
    WHERE Role COLLATE Latin1_General_100_BIN2 NOT IN (N'Admin', N'User');
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Users_Username' AND object_id = OBJECT_ID(N'dbo.Users'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Users_Username ON dbo.Users (Username);
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Users_Role' AND parent_object_id = OBJECT_ID(N'dbo.Users'))
BEGIN
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role
        CHECK (Role COLLATE Latin1_General_100_BIN2 IN (N'Admin', N'User'));
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'FlightJourneyDate') IS NULL
    ALTER TABLE dbo.Bookings ADD FlightJourneyDate DATE NULL;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'DistanceKm') IS NULL
    ALTER TABLE dbo.Bookings ADD DistanceKm DECIMAL(10,2) NULL;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'BaseFare') IS NULL
    ALTER TABLE dbo.Bookings ADD BaseFare DECIMAL(18,2) NULL;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'Taxes') IS NULL
    ALTER TABLE dbo.Bookings ADD Taxes DECIMAL(18,2) NULL;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'DiscountAmount') IS NULL
    ALTER TABLE dbo.Bookings ADD DiscountAmount DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Bookings_DiscountAmount DEFAULT 0 WITH VALUES;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'IdempotencyKey') IS NULL
    ALTER TABLE dbo.Bookings ADD IdempotencyKey UNIQUEIDENTIFIER NULL;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'PassengerCount') IS NULL
    ALTER TABLE dbo.Bookings ADD PassengerCount INT NOT NULL
        CONSTRAINT DF_Bookings_PassengerCount DEFAULT 1 WITH VALUES;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'PassengerDetails') IS NULL
    ALTER TABLE dbo.Bookings ADD PassengerDetails NVARCHAR(MAX) NULL;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'PassengerDob') IS NULL
    ALTER TABLE dbo.Bookings ADD PassengerDob DATE NULL;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Bookings_User_IdempotencyKey' AND object_id = OBJECT_ID(N'dbo.Bookings'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Bookings_User_IdempotencyKey
        ON dbo.Bookings (UserId, IdempotencyKey)
        WHERE IdempotencyKey IS NOT NULL;
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.Bookings', N'FlightJourneyDate') IS NOT NULL
    AND COL_LENGTH(N'dbo.Flights', N'DepartureDate') IS NOT NULL
BEGIN
    UPDATE b
    SET FlightJourneyDate = f.DepartureDate
    FROM dbo.Bookings AS b
    INNER JOIN dbo.Flights AS f ON f.FlightId = b.FlightId
    WHERE b.FlightJourneyDate IS NULL;
END;

IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.Bookings', N'DistanceKm') IS NOT NULL
    AND COL_LENGTH(N'dbo.Flights', N'DistanceKm') IS NOT NULL
BEGIN
    UPDATE b
    SET DistanceKm = f.DistanceKm
    FROM dbo.Bookings AS b
    INNER JOIN dbo.Flights AS f ON f.FlightId = b.FlightId
    WHERE b.DistanceKm IS NULL AND f.DistanceKm IS NOT NULL;
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'UserId') IS NULL
    ALTER TABLE dbo.Coupons ADD UserId INT NULL;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'GeneratedForBookingId') IS NULL
    ALTER TABLE dbo.Coupons ADD GeneratedForBookingId INT NULL;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'JourneyDate') IS NULL
    ALTER TABLE dbo.Coupons ADD JourneyDate DATE NULL;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'AvailableFromDate') IS NULL
    ALTER TABLE dbo.Coupons ADD AvailableFromDate DATE NULL;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'OriginalFlightFare') IS NULL
    ALTER TABLE dbo.Coupons ADD OriginalFlightFare DECIMAL(18,2) NOT NULL CONSTRAINT DF_Coupons_OriginalFlightFare DEFAULT 0;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'DiscountPercentage') IS NULL
    ALTER TABLE dbo.Coupons ADD DiscountPercentage DECIMAL(5,2) NOT NULL CONSTRAINT DF_Coupons_DiscountPercentage DEFAULT 0;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'DiscountAmount') IS NULL
    ALTER TABLE dbo.Coupons ADD DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Coupons_DiscountAmount DEFAULT 0;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'CouponPoints') IS NULL
    ALTER TABLE dbo.Coupons ADD CouponPoints DECIMAL(18,4) NOT NULL
        CONSTRAINT DF_Coupons_CouponPoints DEFAULT 0 WITH VALUES;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'DiscountType') IS NULL
    ALTER TABLE dbo.Coupons ADD DiscountType NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Coupons_DiscountType DEFAULT N'Percentage' WITH VALUES;

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Coupons_DiscountValue' AND parent_object_id = OBJECT_ID(N'dbo.Coupons'))
    ALTER TABLE dbo.Coupons DROP CONSTRAINT CK_Coupons_DiscountValue;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Coupons_DiscountValue' AND parent_object_id = OBJECT_ID(N'dbo.Coupons'))
    ALTER TABLE dbo.Coupons ADD CONSTRAINT CK_Coupons_DiscountValue CHECK (DiscountValue >= 0);
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Coupons', N'LegacyCouponCode') IS NULL
    ALTER TABLE dbo.Coupons ADD LegacyCouponCode NVARCHAR(50) NULL;
");

            context.Database.ExecuteSqlRaw(@"
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns AS columnInfo
    INNER JOIN sys.types AS typeInfo ON columnInfo.user_type_id = typeInfo.user_type_id
    WHERE columnInfo.object_id = OBJECT_ID(N'dbo.Coupons')
      AND columnInfo.name = N'CouponCode'
      AND typeInfo.name = N'varchar'
      AND columnInfo.max_length = 8)
   OR EXISTS (
    SELECT 1 FROM dbo.Coupons
    WHERE DATALENGTH(CONVERT(VARCHAR(50), CouponCode)) <> 8
       OR CONVERT(VARCHAR(50), CouponCode) COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Z0-9]%')
BEGIN
    DECLARE @CouponId INT;
    DECLARE @LegacyCouponCode NVARCHAR(50);
    DECLARE @NewCouponCode VARCHAR(8);
    DECLARE legacy_coupon_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT CouponId, CouponCode
        FROM dbo.Coupons
        WHERE DATALENGTH(CONVERT(VARCHAR(50), CouponCode)) <> 8
           OR CONVERT(VARCHAR(50), CouponCode) COLLATE Latin1_General_100_BIN2 LIKE '%[^A-Z0-9]%';

    OPEN legacy_coupon_cursor;
    FETCH NEXT FROM legacy_coupon_cursor INTO @CouponId, @LegacyCouponCode;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @NewCouponCode = UPPER(SUBSTRING(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 1, 8));
        WHILE EXISTS (
            SELECT 1 FROM dbo.Coupons
            WHERE CouponCode = @NewCouponCode OR LegacyCouponCode = @NewCouponCode)
        BEGIN
            SET @NewCouponCode = UPPER(SUBSTRING(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 1, 8));
        END;

        UPDATE dbo.Coupons
        SET LegacyCouponCode = @LegacyCouponCode,
            CouponCode = @NewCouponCode
        WHERE CouponId = @CouponId;
        FETCH NEXT FROM legacy_coupon_cursor INTO @CouponId, @LegacyCouponCode;
    END;
    CLOSE legacy_coupon_cursor;
    DEALLOCATE legacy_coupon_cursor;

    DECLARE @UniqueConstraintName SYSNAME;
    SELECT TOP (1) @UniqueConstraintName = keyConstraint.name
    FROM sys.key_constraints AS keyConstraint
    INNER JOIN sys.index_columns AS indexColumn
        ON indexColumn.object_id = keyConstraint.parent_object_id
       AND indexColumn.index_id = keyConstraint.unique_index_id
       AND indexColumn.key_ordinal = 1
    INNER JOIN sys.columns AS columnInfo
        ON columnInfo.object_id = indexColumn.object_id
       AND columnInfo.column_id = indexColumn.column_id
    WHERE keyConstraint.parent_object_id = OBJECT_ID(N'dbo.Coupons')
      AND keyConstraint.type = N'UQ'
      AND columnInfo.name = N'CouponCode';

    IF @UniqueConstraintName IS NOT NULL
    BEGIN
        DECLARE @DropConstraintSql NVARCHAR(MAX) =
            N'ALTER TABLE dbo.Coupons DROP CONSTRAINT ' + QUOTENAME(@UniqueConstraintName);
        EXEC sp_executesql @DropConstraintSql;
    END;

    DECLARE @UniqueIndexName SYSNAME;
    SELECT TOP (1) @UniqueIndexName = indexInfo.name
    FROM sys.indexes AS indexInfo
    INNER JOIN sys.index_columns AS indexColumn
        ON indexColumn.object_id = indexInfo.object_id
       AND indexColumn.index_id = indexInfo.index_id
       AND indexColumn.key_ordinal = 1
    INNER JOIN sys.columns AS columnInfo
        ON columnInfo.object_id = indexColumn.object_id
       AND columnInfo.column_id = indexColumn.column_id
    WHERE indexInfo.object_id = OBJECT_ID(N'dbo.Coupons')
      AND indexInfo.is_unique = 1
      AND indexInfo.is_primary_key = 0
      AND indexInfo.is_unique_constraint = 0
      AND columnInfo.name = N'CouponCode';

    IF @UniqueIndexName IS NOT NULL
    BEGIN
        DECLARE @DropIndexSql NVARCHAR(MAX) =
            N'DROP INDEX ' + QUOTENAME(@UniqueIndexName) + N' ON dbo.Coupons';
        EXEC sp_executesql @DropIndexSql;
    END;

    ALTER TABLE dbo.Coupons ALTER COLUMN CouponCode VARCHAR(8) NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Coupons_CouponCode' AND object_id = OBJECT_ID(N'dbo.Coupons'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Coupons_CouponCode ON dbo.Coupons (CouponCode);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Coupons_CouponCode_Format' AND parent_object_id = OBJECT_ID(N'dbo.Coupons'))
    ALTER TABLE dbo.Coupons ADD CONSTRAINT CK_Coupons_CouponCode_Format
        CHECK (DATALENGTH(CouponCode) = 8 AND CouponCode COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Z0-9]%');

COMMIT TRANSACTION;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Coupons_Users')
BEGIN
    ALTER TABLE dbo.Coupons ADD CONSTRAINT FK_Coupons_Users
        FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION;
END;

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Coupons_GeneratedBooking')
BEGIN
    ALTER TABLE dbo.Coupons ADD CONSTRAINT FK_Coupons_GeneratedBooking
        FOREIGN KEY (GeneratedForBookingId) REFERENCES dbo.Bookings (BookingId) ON DELETE NO ACTION;
END;

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Coupons_GeneratedForBookingId' AND object_id = OBJECT_ID(N'dbo.Coupons'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Coupons_GeneratedForBookingId
        ON dbo.Coupons (GeneratedForBookingId)
        WHERE GeneratedForBookingId IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Coupons_Status_AvailableFromDate' AND object_id = OBJECT_ID(N'dbo.Coupons'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Coupons_Status_AvailableFromDate
        ON dbo.Coupons (Status, AvailableFromDate);
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
    UPDATE dbo.Coupons SET Status = N'Expired' WHERE Status = N'Inactive';

IF OBJECT_ID(N'dbo.CouponUsage', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_CouponUsage_CouponId' AND object_id = OBJECT_ID(N'dbo.CouponUsage'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_CouponUsage_CouponId
        ON dbo.CouponUsage (CouponId);
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Flights', N'DistanceKm') IS NOT NULL
BEGIN
    UPDATE dbo.Flights
    SET Price = CASE
        WHEN DistanceKm * 4 < 1500 THEN 1500
        ELSE ROUND(DistanceKm * 4, 0)
    END
    WHERE DistanceKm IS NOT NULL AND DistanceKm > 0;
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.CouponTransactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CouponTransactions (
        CouponTransactionId INT IDENTITY(1,1) NOT NULL,
        UserId INT NOT NULL,
        BookingId INT NULL,
        TransactionType NVARCHAR(20) NOT NULL,
        Points DECIMAL(18,4) NOT NULL,
        DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_CouponTransactions_DiscountAmount DEFAULT 0,
        Status NVARCHAR(20) NOT NULL,
        TransactionDate DATETIME2 NOT NULL CONSTRAINT DF_CouponTransactions_TransactionDate DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CouponTransactions PRIMARY KEY CLUSTERED (CouponTransactionId ASC),
        CONSTRAINT FK_CouponTransactions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION,
        CONSTRAINT CK_CouponTransactions_Points CHECK (Points > 0),
        CONSTRAINT CK_CouponTransactions_DiscountAmount CHECK (DiscountAmount >= 0),
        CONSTRAINT CK_CouponTransactions_Type CHECK (TransactionType IN (N'Earned', N'Redeemed')),
        CONSTRAINT CK_CouponTransactions_Status CHECK (Status IN (N'Available', N'Pending', N'Redeemed', N'Used', N'Cancelled'))
    );
END
ELSE
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_CouponTransactions_Status')
    BEGIN
        ALTER TABLE dbo.CouponTransactions DROP CONSTRAINT CK_CouponTransactions_Status;
        ALTER TABLE dbo.CouponTransactions ADD CONSTRAINT CK_CouponTransactions_Status CHECK (Status IN (N'Available', N'Pending', N'Redeemed', N'Used', N'Cancelled'));
    END;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_CouponTransactions_Booking_Type' AND object_id = OBJECT_ID(N'dbo.CouponTransactions'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_CouponTransactions_Booking_Type
        ON dbo.CouponTransactions (BookingId, TransactionType)
        WHERE BookingId IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CouponTransactions_User_Status_Type' AND object_id = OBJECT_ID(N'dbo.CouponTransactions'))
    CREATE NONCLUSTERED INDEX IX_CouponTransactions_User_Status_Type
        ON dbo.CouponTransactions (UserId, Status, TransactionType);

IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.CouponUsage', N'U') IS NOT NULL
BEGIN
    UPDATE booking
    SET DiscountAmount =
        ISNULL((SELECT SUM(couponUsage.DiscountAmount)
                FROM dbo.CouponUsage AS couponUsage
                WHERE couponUsage.BookingId = booking.BookingId), 0) +
        ISNULL((SELECT SUM(pointTransaction.DiscountAmount)
                FROM dbo.CouponTransactions AS pointTransaction
                WHERE pointTransaction.BookingId = booking.BookingId
                  AND pointTransaction.TransactionType = N'Redeemed'), 0)
    FROM dbo.Bookings AS booking
    WHERE booking.DiscountAmount = 0
      AND (EXISTS (SELECT 1 FROM dbo.CouponUsage AS couponUsage WHERE couponUsage.BookingId = booking.BookingId)
           OR EXISTS (SELECT 1 FROM dbo.CouponTransactions AS pointTransaction
                      WHERE pointTransaction.BookingId = booking.BookingId
                        AND pointTransaction.TransactionType = N'Redeemed'));
END;

IF OBJECT_ID(N'dbo.CouponUsage', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
BEGIN
    UPDATE c
    SET c.UsedCount = CASE WHEN c.UsedCount > 0 THEN c.UsedCount - 1 ELSE 0 END,
        c.Status = N'Available'
    FROM dbo.Coupons c
    INNER JOIN dbo.CouponUsage cu ON c.CouponId = cu.CouponId
    INNER JOIN dbo.Bookings b ON cu.BookingId = b.BookingId
    WHERE b.BookingStatus = N'Cancelled';

    DELETE cu
    FROM dbo.CouponUsage cu
    INNER JOIN dbo.Bookings b ON cu.BookingId = b.BookingId
    WHERE b.BookingStatus = N'Cancelled';
END;

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL
BEGIN
    DELETE cu
    FROM dbo.CouponUsage cu
    INNER JOIN dbo.Coupons c ON cu.CouponId = c.CouponId
    INNER JOIN dbo.Bookings b ON c.GeneratedForBookingId = b.BookingId
    WHERE b.BookingStatus = N'Cancelled';

    DELETE c
    FROM dbo.Coupons c
    INNER JOIN dbo.Bookings b ON c.GeneratedForBookingId = b.BookingId
    WHERE b.BookingStatus = N'Cancelled';
END;

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
BEGIN
    UPDATE dbo.Coupons
    SET Status = N'Available', UsedCount = 0
    WHERE Status = N'Used'
      AND ExpiryDate > GETUTCDATE()
      AND NOT EXISTS (
          SELECT 1 FROM dbo.CouponUsage cu
          INNER JOIN dbo.Bookings b ON cu.BookingId = b.BookingId
          WHERE cu.CouponId = dbo.Coupons.CouponId AND b.BookingStatus <> N'Cancelled'
      );
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'CancelDate') IS NULL
    ALTER TABLE dbo.Bookings ADD CancelDate DATETIME2 NULL;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Bookings', N'CancelDate') IS NOT NULL
    EXEC(N'UPDATE dbo.Bookings SET CancelDate = BookingDate WHERE BookingStatus = ''Cancelled'' AND CancelDate IS NULL;');
");

            // Make CouponTransactions.BookingId nullable so points-redemption rows (no booking) can be inserted.
            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.CouponTransactions', N'U') IS NOT NULL
   AND COLUMNPROPERTY(OBJECT_ID(N'dbo.CouponTransactions'), N'BookingId', 'AllowsNull') = 0
BEGIN
    -- Drop old filtered/unfiltered unique index so we can recreate it with WHERE BookingId IS NOT NULL
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_CouponTransactions_Booking_Type' AND object_id = OBJECT_ID(N'dbo.CouponTransactions'))
        DROP INDEX UX_CouponTransactions_Booking_Type ON dbo.CouponTransactions;

    -- Drop the NOT NULL FK constraint before altering the column
    IF EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_CouponTransactions_Bookings'
          AND parent_object_id = OBJECT_ID(N'dbo.CouponTransactions'))
        ALTER TABLE dbo.CouponTransactions DROP CONSTRAINT FK_CouponTransactions_Bookings;

    -- Allow NULL in BookingId (points-redemption transactions have no booking)
    ALTER TABLE dbo.CouponTransactions ALTER COLUMN BookingId INT NULL;

    -- Recreate the unique index filtered to rows where BookingId is not null
    CREATE UNIQUE NONCLUSTERED INDEX UX_CouponTransactions_Booking_Type
        ON dbo.CouponTransactions (BookingId, TransactionType)
        WHERE BookingId IS NOT NULL;
END;
");

            // Synchronize existing CouponTransactions.Status with Coupon.Status so Pending coupons have Pending transactions
            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.CouponTransactions', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
BEGIN
    UPDATE t
    SET t.Status = N'Pending'
    FROM dbo.CouponTransactions t
    INNER JOIN dbo.Coupons c ON t.BookingId = c.GeneratedForBookingId
    WHERE t.TransactionType = N'Earned'
      AND c.Status = N'Pending'
      AND t.Status <> N'Pending';

    UPDATE t
    SET t.Status = N'Available'
    FROM dbo.CouponTransactions t
    INNER JOIN dbo.Coupons c ON t.BookingId = c.GeneratedForBookingId
    WHERE t.TransactionType = N'Earned'
      AND c.Status = N'Available'
      AND t.Status <> N'Available';
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'Username') IS NULL
    ALTER TABLE dbo.Coupons ADD Username NVARCHAR(150) NULL;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'PassengerName') IS NULL
    ALTER TABLE dbo.Coupons ADD PassengerName NVARCHAR(150) NULL;

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'AvailableCoupons') IS NULL
    ALTER TABLE dbo.Users ADD AvailableCoupons INT NOT NULL CONSTRAINT DF_Users_AvailableCoupons DEFAULT 0 WITH VALUES;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'PendingCoupons') IS NULL
    ALTER TABLE dbo.Users ADD PendingCoupons INT NOT NULL CONSTRAINT DF_Users_PendingCoupons DEFAULT 0 WITH VALUES;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'ExpiredCoupons') IS NULL
    ALTER TABLE dbo.Users ADD ExpiredCoupons INT NOT NULL CONSTRAINT DF_Users_ExpiredCoupons DEFAULT 0 WITH VALUES;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'UsedCoupons') IS NULL
    ALTER TABLE dbo.Users ADD UsedCoupons INT NOT NULL CONSTRAINT DF_Users_UsedCoupons DEFAULT 0 WITH VALUES;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'TotalCoupons') IS NULL
    ALTER TABLE dbo.Users ADD TotalCoupons INT NOT NULL CONSTRAINT DF_Users_TotalCoupons DEFAULT 0 WITH VALUES;

IF OBJECT_ID(N'dbo.UserCouponCounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserCouponCounts (
        Id INT IDENTITY(1,1) NOT NULL,
        UserId INT NOT NULL,
        Username NVARCHAR(150) NOT NULL,
        AvailableCoupons INT NOT NULL CONSTRAINT DF_UserCouponCounts_Available DEFAULT 0,
        PendingCoupons INT NOT NULL CONSTRAINT DF_UserCouponCounts_Pending DEFAULT 0,
        ExpiredCoupons INT NOT NULL CONSTRAINT DF_UserCouponCounts_Expired DEFAULT 0,
        UsedCoupons INT NOT NULL CONSTRAINT DF_UserCouponCounts_Used DEFAULT 0,
        TotalCoupons INT NOT NULL CONSTRAINT DF_UserCouponCounts_Total DEFAULT 0,
        LastUpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_UserCouponCounts_LastUpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_UserCouponCounts PRIMARY KEY CLUSTERED (Id ASC),
        CONSTRAINT UQ_UserCouponCounts_UserId UNIQUE NONCLUSTERED (UserId ASC),
        CONSTRAINT FK_UserCouponCounts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX IX_UserCouponCounts_Username ON dbo.UserCouponCounts (Username);
END;
");

            context.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL 
   AND OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL 
   AND COL_LENGTH(N'dbo.Coupons', N'Username') IS NOT NULL
BEGIN
    EXEC sp_executesql N'UPDATE c SET c.Username = u.Username FROM dbo.Coupons c INNER JOIN dbo.Users u ON c.UserId = u.Id WHERE c.Username IS NULL OR c.Username = ''''';
END;
");
        }

        private static void EnsureUserCouponCounts(FlightBookingDbContext context)
        {
            var users = context.Users.ToList();
            if (!users.Any()) return;

            var userIds = users.Select(u => u.Id).ToList();
            var coupons = context.Coupons
                .Where(c => c.UserId != null &&
                            userIds.Contains(c.UserId.Value) &&
                            c.Status != "Cancelled" &&
                            (c.GeneratedForBooking == null || c.GeneratedForBooking.BookingStatus != BookingStatuses.Cancelled))
                .ToList();

            // Backfill Username on Coupons if missing
            var userMap = users.ToDictionary(u => u.Id);
            foreach (var c in coupons)
            {
                if (string.IsNullOrEmpty(c.Username) && c.UserId.HasValue && userMap.TryGetValue(c.UserId.Value, out var u))
                {
                    c.Username = u.Username;
                }
            }

            var existingCounts = context.UserCouponCounts
                .Where(ucc => userIds.Contains(ucc.UserId))
                .ToDictionary(ucc => ucc.UserId);

            var now = DateTime.UtcNow;

            foreach (var user in users)
            {
                var userCoupons = coupons.Where(c => c.UserId == user.Id).ToList();
                var available = userCoupons.Count(c => c.Status == "Available");
                var pending = userCoupons.Count(c => c.Status == "Pending");
                var used = userCoupons.Count(c => c.Status == "Used");
                var expired = userCoupons.Count(c => c.Status == "Expired" || c.Status == "Inactive");
                var total = available + pending + used + expired;

                user.AvailableCoupons = available;
                user.PendingCoupons = pending;
                user.ExpiredCoupons = expired;
                user.UsedCoupons = used;
                user.TotalCoupons = total;

                if (existingCounts.TryGetValue(user.Id, out var countRecord))
                {
                    countRecord.Username = user.Username;
                    countRecord.AvailableCoupons = available;
                    countRecord.PendingCoupons = pending;
                    countRecord.ExpiredCoupons = expired;
                    countRecord.UsedCoupons = used;
                    countRecord.TotalCoupons = total;
                    countRecord.LastUpdatedAt = now;
                }
                else
                {
                    context.UserCouponCounts.Add(new UserCouponCount
                    {
                        UserId = user.Id,
                        Username = user.Username,
                        AvailableCoupons = available,
                        PendingCoupons = pending,
                        ExpiredCoupons = expired,
                        UsedCoupons = used,
                        TotalCoupons = total,
                        LastUpdatedAt = now
                    });
                }
            }

            if (context.ChangeTracker.HasChanges())
            {
                context.SaveChanges();
            }
        }
    }
}
