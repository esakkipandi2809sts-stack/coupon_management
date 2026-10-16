-- Idempotent upgrade for existing FlightBooking_DB installations.
-- Existing flight distances must be populated from a verified route-distance source
-- before bookings can be made for those flights; the script intentionally does not guess.
USE FlightBooking_DB;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.Flights', N'DistanceKm') IS NULL
    ALTER TABLE dbo.Flights ADD DistanceKm DECIMAL(10,2) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Flights_DistanceKm')
    ALTER TABLE dbo.Flights ADD CONSTRAINT CK_Flights_DistanceKm
        CHECK (DistanceKm IS NULL OR DistanceKm > 0);

IF COL_LENGTH(N'dbo.Bookings', N'FlightJourneyDate') IS NULL
    ALTER TABLE dbo.Bookings ADD FlightJourneyDate DATE NULL;
IF COL_LENGTH(N'dbo.Bookings', N'DistanceKm') IS NULL
    ALTER TABLE dbo.Bookings ADD DistanceKm DECIMAL(10,2) NULL;
IF COL_LENGTH(N'dbo.Bookings', N'BaseFare') IS NULL
    ALTER TABLE dbo.Bookings ADD BaseFare DECIMAL(18,2) NULL;
IF COL_LENGTH(N'dbo.Bookings', N'Taxes') IS NULL
    ALTER TABLE dbo.Bookings ADD Taxes DECIMAL(18,2) NULL;

UPDATE b
SET FlightJourneyDate = f.DepartureDate
FROM dbo.Bookings AS b
INNER JOIN dbo.Flights AS f ON f.FlightId = b.FlightId
WHERE b.FlightJourneyDate IS NULL;

UPDATE b
SET DistanceKm = f.DistanceKm
FROM dbo.Bookings AS b
INNER JOIN dbo.Flights AS f ON f.FlightId = b.FlightId
WHERE b.DistanceKm IS NULL AND f.DistanceKm IS NOT NULL;

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

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Coupons_Users')
    ALTER TABLE dbo.Coupons ADD CONSTRAINT FK_Coupons_Users
        FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Coupons_GeneratedBooking')
    ALTER TABLE dbo.Coupons ADD CONSTRAINT FK_Coupons_GeneratedBooking
        FOREIGN KEY (GeneratedForBookingId) REFERENCES dbo.Bookings (BookingId) ON DELETE NO ACTION;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Coupons_GeneratedForBookingId' AND object_id = OBJECT_ID(N'dbo.Coupons'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Coupons_GeneratedForBookingId
        ON dbo.Coupons (GeneratedForBookingId)
        WHERE GeneratedForBookingId IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Coupons_Status_AvailableFromDate' AND object_id = OBJECT_ID(N'dbo.Coupons'))
    CREATE NONCLUSTERED INDEX IX_Coupons_Status_AvailableFromDate
        ON dbo.Coupons (Status, AvailableFromDate);

UPDATE dbo.Flights
SET Price = CASE
    WHEN DistanceKm * 10 < 1500 THEN 1500
    ELSE ROUND(DistanceKm * 10, 2)
END
WHERE DistanceKm IS NOT NULL;

COMMIT TRANSACTION;
GO

-- Populate these with verified route distances before enabling bookings for legacy flights.
SELECT FlightId, FlightNumber, FromCity, ToCity
FROM dbo.Flights
WHERE DistanceKm IS NULL;
