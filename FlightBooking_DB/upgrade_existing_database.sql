-- ============================================================================
-- SkyWings Flight Booking - in-place upgrade for an EXISTING FlightBooking_DB
-- Idempotent: safe to run more than once. Does not delete data.
-- (The backend also applies these additive upgrades and the fare backfill
--  automatically at startup; this script is for running them manually.)
-- ============================================================================
USE FlightBooking_DB;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Users: Username + Role
IF COL_LENGTH(N'dbo.Users', N'Role') IS NULL
    ALTER TABLE dbo.Users ADD Role NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Users_Role DEFAULT N'User' WITH VALUES;
IF COL_LENGTH(N'dbo.Users', N'Username') IS NULL
    ALTER TABLE dbo.Users ADD Username NVARCHAR(150) NOT NULL
        CONSTRAINT DF_Users_Username DEFAULT N'' WITH VALUES;

-- Flights / Bookings: route distance and fare columns
IF COL_LENGTH(N'dbo.Flights', N'DistanceKm') IS NULL
    ALTER TABLE dbo.Flights ADD DistanceKm DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.Flights', N'StopCount') IS NULL
    ALTER TABLE dbo.Flights ADD StopCount INT NULL;
IF COL_LENGTH(N'dbo.Flights', N'BookingDate') IS NULL
    ALTER TABLE dbo.Flights ADD BookingDate DATE NULL
        CONSTRAINT DF_Flights_BookingDate DEFAULT CAST(GETDATE() AS DATE) WITH VALUES;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Flights_StopCount' AND parent_object_id = OBJECT_ID(N'dbo.Flights'))
    ALTER TABLE dbo.Flights ADD CONSTRAINT CK_Flights_StopCount
        CHECK (StopCount IS NULL OR StopCount BETWEEN 0 AND 99);
IF COL_LENGTH(N'dbo.Bookings', N'FlightJourneyDate') IS NULL
    ALTER TABLE dbo.Bookings ADD FlightJourneyDate DATE NULL;
IF COL_LENGTH(N'dbo.Bookings', N'DistanceKm') IS NULL
    ALTER TABLE dbo.Bookings ADD DistanceKm DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.Bookings', N'BaseFare') IS NULL
    ALTER TABLE dbo.Bookings ADD BaseFare DECIMAL(18,2) NULL;
IF COL_LENGTH(N'dbo.Bookings', N'Taxes') IS NULL
    ALTER TABLE dbo.Bookings ADD Taxes DECIMAL(18,2) NULL;
IF COL_LENGTH(N'dbo.Bookings', N'DiscountAmount') IS NULL
    ALTER TABLE dbo.Bookings ADD DiscountAmount DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Bookings_DiscountAmount DEFAULT 0 WITH VALUES;
IF COL_LENGTH(N'dbo.Bookings', N'IdempotencyKey') IS NULL
    ALTER TABLE dbo.Bookings ADD IdempotencyKey UNIQUEIDENTIFIER NULL;
IF COL_LENGTH(N'dbo.Bookings', N'PassengerCount') IS NULL
    ALTER TABLE dbo.Bookings ADD PassengerCount INT NOT NULL
        CONSTRAINT DF_Bookings_PassengerCount DEFAULT 1 WITH VALUES;

-- Coupons: passenger-scoped reward columns
IF COL_LENGTH(N'dbo.Coupons', N'UserId') IS NULL
    ALTER TABLE dbo.Coupons ADD UserId INT NULL;
IF COL_LENGTH(N'dbo.Coupons', N'GeneratedForBookingId') IS NULL
    ALTER TABLE dbo.Coupons ADD GeneratedForBookingId INT NULL;
IF COL_LENGTH(N'dbo.Coupons', N'JourneyDate') IS NULL
    ALTER TABLE dbo.Coupons ADD JourneyDate DATE NULL;
IF COL_LENGTH(N'dbo.Coupons', N'AvailableFromDate') IS NULL
    ALTER TABLE dbo.Coupons ADD AvailableFromDate DATE NULL;
IF COL_LENGTH(N'dbo.Coupons', N'OriginalFlightFare') IS NULL
    ALTER TABLE dbo.Coupons ADD OriginalFlightFare DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Coupons_OriginalFlightFare DEFAULT 0;
IF COL_LENGTH(N'dbo.Coupons', N'DiscountPercentage') IS NULL
    ALTER TABLE dbo.Coupons ADD DiscountPercentage DECIMAL(5,2) NOT NULL
        CONSTRAINT DF_Coupons_DiscountPercentage DEFAULT 0;
IF COL_LENGTH(N'dbo.Coupons', N'DiscountAmount') IS NULL
    ALTER TABLE dbo.Coupons ADD DiscountAmount DECIMAL(18,2) NOT NULL
        CONSTRAINT DF_Coupons_DiscountAmount DEFAULT 0;
IF COL_LENGTH(N'dbo.Coupons', N'CouponPoints') IS NULL
    ALTER TABLE dbo.Coupons ADD CouponPoints DECIMAL(18,4) NOT NULL
        CONSTRAINT DF_Coupons_CouponPoints DEFAULT 0 WITH VALUES;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Coupons_DiscountValue' AND parent_object_id = OBJECT_ID(N'dbo.Coupons'))
    ALTER TABLE dbo.Coupons DROP CONSTRAINT CK_Coupons_DiscountValue;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Coupons_DiscountValue' AND parent_object_id = OBJECT_ID(N'dbo.Coupons'))
    ALTER TABLE dbo.Coupons ADD CONSTRAINT CK_Coupons_DiscountValue CHECK (DiscountValue >= 0);
COMMIT TRANSACTION;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Normalise data
UPDATE dbo.Users SET Username = LOWER(Email) WHERE Username = N'';
UPDATE dbo.Users
SET Role = CASE WHEN LOWER(Role) = N'admin' THEN N'Admin' ELSE N'User' END
WHERE Role COLLATE Latin1_General_100_BIN2 NOT IN (N'Admin', N'User');

UPDATE b SET FlightJourneyDate = f.DepartureDate
FROM dbo.Bookings AS b INNER JOIN dbo.Flights AS f ON f.FlightId = b.FlightId
WHERE b.FlightJourneyDate IS NULL;

UPDATE b SET DistanceKm = f.DistanceKm
FROM dbo.Bookings AS b INNER JOIN dbo.Flights AS f ON f.FlightId = b.FlightId
WHERE b.DistanceKm IS NULL AND f.DistanceKm IS NOT NULL;

UPDATE dbo.Coupons SET Status = N'Expired' WHERE Status = N'Inactive';

-- Constraints and indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Users_Username' AND object_id = OBJECT_ID(N'dbo.Users'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Users_Username ON dbo.Users (Username);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Bookings_User_IdempotencyKey' AND object_id = OBJECT_ID(N'dbo.Bookings'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Bookings_User_IdempotencyKey
        ON dbo.Bookings (UserId, IdempotencyKey) WHERE IdempotencyKey IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Users_Role' AND parent_object_id = OBJECT_ID(N'dbo.Users'))
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role
        CHECK (Role COLLATE Latin1_General_100_BIN2 IN (N'Admin', N'User'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Flights_DistanceKm')
    ALTER TABLE dbo.Flights ADD CONSTRAINT CK_Flights_DistanceKm
        CHECK (DistanceKm IS NULL OR DistanceKm > 0);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Coupons_Users')
    ALTER TABLE dbo.Coupons ADD CONSTRAINT FK_Coupons_Users
        FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Coupons_GeneratedBooking')
    ALTER TABLE dbo.Coupons ADD CONSTRAINT FK_Coupons_GeneratedBooking
        FOREIGN KEY (GeneratedForBookingId) REFERENCES dbo.Bookings (BookingId) ON DELETE NO ACTION;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Coupons_GeneratedForBookingId' AND object_id = OBJECT_ID(N'dbo.Coupons'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Coupons_GeneratedForBookingId
        ON dbo.Coupons (GeneratedForBookingId) WHERE GeneratedForBookingId IS NOT NULL;

IF COL_LENGTH(N'dbo.Coupons', N'LegacyCouponCode') IS NULL
    ALTER TABLE dbo.Coupons ADD LegacyCouponCode NVARCHAR(50) NULL;
GO

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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Coupons_Status_AvailableFromDate' AND object_id = OBJECT_ID(N'dbo.Coupons'))
    CREATE NONCLUSTERED INDEX IX_Coupons_Status_AvailableFromDate ON dbo.Coupons (Status, AvailableFromDate);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_CouponUsage_CouponId' AND object_id = OBJECT_ID(N'dbo.CouponUsage'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_CouponUsage_CouponId ON dbo.CouponUsage (CouponId);

IF OBJECT_ID(N'dbo.CouponTransactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CouponTransactions (
        CouponTransactionId INT IDENTITY(1,1) NOT NULL,
        UserId INT NOT NULL,
        BookingId INT NOT NULL,
        TransactionType NVARCHAR(20) NOT NULL,
        Points DECIMAL(18,4) NOT NULL,
        DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_CouponTransactions_DiscountAmount DEFAULT 0,
        Status NVARCHAR(20) NOT NULL,
        TransactionDate DATETIME2 NOT NULL CONSTRAINT DF_CouponTransactions_TransactionDate DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CouponTransactions PRIMARY KEY CLUSTERED (CouponTransactionId ASC),
        CONSTRAINT FK_CouponTransactions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION,
        CONSTRAINT FK_CouponTransactions_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (BookingId) ON DELETE NO ACTION,
        CONSTRAINT CK_CouponTransactions_Points CHECK (Points > 0),
        CONSTRAINT CK_CouponTransactions_DiscountAmount CHECK (DiscountAmount >= 0),
        CONSTRAINT CK_CouponTransactions_Type CHECK (TransactionType IN (N'Earned', N'Redeemed')),
        CONSTRAINT CK_CouponTransactions_Status CHECK (Status IN (N'Available', N'Pending', N'Redeemed', N'Cancelled'))
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_CouponTransactions_Booking_Type' AND object_id = OBJECT_ID(N'dbo.CouponTransactions'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_CouponTransactions_Booking_Type
        ON dbo.CouponTransactions (BookingId, TransactionType);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CouponTransactions_User_Status_Type' AND object_id = OBJECT_ID(N'dbo.CouponTransactions'))
    CREATE NONCLUSTERED INDEX IX_CouponTransactions_User_Status_Type
        ON dbo.CouponTransactions (UserId, Status, TransactionType);

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

-- Economy fare = MAX(DistanceKm x 4, 1500) for every flight that has a distance
UPDATE dbo.Flights
SET Price = CASE WHEN DistanceKm * 4 < 1500 THEN 1500 ELSE ROUND(DistanceKm * 4, 0) END
WHERE DistanceKm IS NOT NULL AND DistanceKm > 0;

COMMIT TRANSACTION;
GO

-- Flights still without a distance show "Fare unavailable" in the app.
-- Starting the backend fills these in automatically when both cities are in its
-- supported city list. Anything listed here after that needs a real distance
-- (Flight Management > edit, or UPDATE dbo.Flights SET DistanceKm = <km> ...).
SELECT FlightId, FlightNumber, FromCity, ToCity, DistanceKm, Price
FROM dbo.Flights
WHERE DistanceKm IS NULL OR DistanceKm <= 0;
GO

-- Optional: promote an existing account to Admin (replace the email first).
-- UPDATE dbo.Users SET Role = N'Admin' WHERE Email = N'you@example.com';
GO
