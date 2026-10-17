SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================================
-- SkyWings Flight Booking - Database script (fresh install)
-- Database: FlightBooking_DB
-- Target:   SQL Server 2016+ / Azure SQL / SQL Server LocalDB
--
-- WARNING: this script DROPS and recreates all tables. Existing data is lost.
-- For an existing database use upgrade_existing_database.sql instead.
--
-- No users or flights are seeded here:
--   * The first backend start seeds demo passengers (password: Password123!)
--     with a real BCrypt hash when the Users table is empty.
--   * Flights are created from the app (Flight Management page).
-- ============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'FlightBooking_DB')
BEGIN
    CREATE DATABASE FlightBooking_DB;
END
GO

USE FlightBooking_DB;
GO

IF OBJECT_ID(N'dbo.CouponUsage', N'U') IS NOT NULL DROP TABLE dbo.CouponUsage;
IF OBJECT_ID(N'dbo.CouponTransactions', N'U') IS NOT NULL DROP TABLE dbo.CouponTransactions;
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL DROP TABLE dbo.Coupons;
IF OBJECT_ID(N'dbo.Bookings', N'U') IS NOT NULL DROP TABLE dbo.Bookings;
IF OBJECT_ID(N'dbo.Flights', N'U') IS NOT NULL DROP TABLE dbo.Flights;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL DROP TABLE dbo.Users;
GO

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------
CREATE TABLE dbo.Users (
    Id INT IDENTITY(1,1) NOT NULL,
    FullName NVARCHAR(150) NOT NULL,
    Username NVARCHAR(150) NOT NULL,
    Email NVARCHAR(150) NOT NULL,
    PhoneNumber NVARCHAR(30) NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Role NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_Role DEFAULT N'User',
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (Id ASC),
    CONSTRAINT UQ_Users_Email UNIQUE NONCLUSTERED (Email ASC),
    CONSTRAINT CK_Users_Role CHECK (Role COLLATE Latin1_General_100_BIN2 IN (N'Admin', N'User'))
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UX_Users_Username ON dbo.Users (Username);
GO

-- ----------------------------------------------------------------------------
-- Flights  (Price = economy fare = MAX(DistanceKm x 10, 1500))
-- ----------------------------------------------------------------------------
CREATE TABLE dbo.Flights (
    FlightId INT IDENTITY(1,1) NOT NULL,
    FlightNumber NVARCHAR(50) NOT NULL,
    Airline NVARCHAR(100) NOT NULL,
    FromCity NVARCHAR(100) NOT NULL,
    ToCity NVARCHAR(100) NOT NULL,
    FromAirportCode VARCHAR(3) NULL,
    ToAirportCode VARCHAR(3) NULL,
    StopCount INT NULL,
    BookingDate DATE NOT NULL CONSTRAINT DF_Flights_BookingDate DEFAULT CAST(GETDATE() AS DATE),
    DepartureDate DATE NOT NULL,
    DepartureTime NVARCHAR(10) NOT NULL,
    ArrivalDate DATE NOT NULL,
    ArrivalTime NVARCHAR(10) NOT NULL,
    Duration NVARCHAR(50) NOT NULL,
    DistanceKm DECIMAL(10,2) NOT NULL,
    TotalSeats INT NOT NULL,
    AvailableSeats INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(50) NOT NULL CONSTRAINT DF_Flights_Status DEFAULT N'Scheduled',
    CreatedByUserName NVARCHAR(150) NULL,
    TripType NVARCHAR(20) NOT NULL CONSTRAINT DF_Flights_TripType DEFAULT N'OneWay',
    ItineraryId UNIQUEIDENTIFIER NULL,
    SegmentOrder INT NULL,
    CONSTRAINT PK_Flights PRIMARY KEY CLUSTERED (FlightId ASC),
    CONSTRAINT CK_Flights_DistanceKm CHECK (DistanceKm > 0),
    CONSTRAINT CK_Flights_Seats CHECK (AvailableSeats >= 0 AND AvailableSeats <= TotalSeats),
    CONSTRAINT CK_Flights_Price CHECK (Price >= 0),
    CONSTRAINT CK_Flights_StopCount CHECK (StopCount IS NULL OR StopCount BETWEEN 0 AND 99),
    CONSTRAINT CK_Flights_TripType CHECK (TripType IN (N'OneWay', N'RoundTrip', N'MultiCity'))
);
GO
CREATE NONCLUSTERED INDEX IX_Flights_Route_Date ON dbo.Flights (FromCity, ToCity, DepartureDate);
GO
CREATE NONCLUSTERED INDEX IX_Flights_ItineraryId ON dbo.Flights (ItineraryId) WHERE ItineraryId IS NOT NULL;
GO
CREATE UNIQUE NONCLUSTERED INDEX UX_Flights_Itinerary_Segment ON dbo.Flights (ItineraryId, SegmentOrder) WHERE ItineraryId IS NOT NULL;
GO

-- ----------------------------------------------------------------------------
-- Coupons
-- ----------------------------------------------------------------------------
CREATE TABLE dbo.Coupons (
    CouponId INT IDENTITY(1,1) NOT NULL,
    CouponCode VARCHAR(8) NOT NULL,
    LegacyCouponCode NVARCHAR(8) NULL,
    Description NVARCHAR(255) NOT NULL,
    DiscountType NVARCHAR(20) NOT NULL,            -- 'Percentage' or 'Fixed'
    DiscountValue DECIMAL(18,2) NOT NULL,
    OriginalFlightFare DECIMAL(18,2) NOT NULL CONSTRAINT DF_Coupons_OriginalFlightFare DEFAULT 0,
    DiscountPercentage DECIMAL(5,2) NOT NULL CONSTRAINT DF_Coupons_DiscountPercentage DEFAULT 0,
    DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Coupons_DiscountAmount DEFAULT 0,
    CouponPoints DECIMAL(18,4) NOT NULL CONSTRAINT DF_Coupons_CouponPoints DEFAULT 0,
    MinimumAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Coupons_MinAmount DEFAULT 0.00,
    MaximumDiscount DECIMAL(18,2) NULL,
    ExpiryDate DATETIME2 NOT NULL,
    TotalUsageLimit INT NOT NULL CONSTRAINT DF_Coupons_UsageLimit DEFAULT 100,
    UsedCount INT NOT NULL CONSTRAINT DF_Coupons_UsedCount DEFAULT 0,
    Status NVARCHAR(50) NOT NULL CONSTRAINT DF_Coupons_Status DEFAULT N'Available', -- Pending | Available | Used | Expired
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Coupons_CreatedAt DEFAULT SYSUTCDATETIME(),
    UserId INT NULL,
    GeneratedForBookingId INT NULL,
    JourneyDate DATE NULL,
    AvailableFromDate DATE NULL,
    CONSTRAINT PK_Coupons PRIMARY KEY CLUSTERED (CouponId ASC),
    CONSTRAINT UQ_Coupons_CouponCode UNIQUE NONCLUSTERED (CouponCode ASC),
    CONSTRAINT CK_Coupons_CouponCode_Format CHECK (
        DATALENGTH(CouponCode) = 8
        AND CouponCode COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Z0-9]%'
    ),
    CONSTRAINT FK_Coupons_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION,
    CONSTRAINT CK_Coupons_DiscountValue CHECK (DiscountValue >= 0),
    CONSTRAINT CK_Coupons_UsedCount CHECK (UsedCount >= 0)
);
GO
CREATE NONCLUSTERED INDEX IX_Coupons_Status_AvailableFromDate ON dbo.Coupons (Status, AvailableFromDate);
GO

-- ----------------------------------------------------------------------------
-- Bookings
-- ----------------------------------------------------------------------------
CREATE TABLE dbo.Bookings (
    BookingId INT IDENTITY(1,1) NOT NULL,
    BookingReference NVARCHAR(50) NOT NULL,
    UserId INT NOT NULL,
    FlightId INT NOT NULL,
    PassengerName NVARCHAR(150) NOT NULL,
    PassengerEmail NVARCHAR(150) NOT NULL,
    PassengerPhone NVARCHAR(50) NOT NULL,
    PassengerAge INT NOT NULL,
    PassengerGender NVARCHAR(20) NOT NULL,
    SeatNumber NVARCHAR(10) NOT NULL,
    Class NVARCHAR(50) NOT NULL CONSTRAINT DF_Bookings_Class DEFAULT N'Economy',
    PassengerCount INT NOT NULL CONSTRAINT DF_Bookings_PassengerCount DEFAULT 1,
    BookingDate DATETIME2 NOT NULL CONSTRAINT DF_Bookings_BookingDate DEFAULT SYSUTCDATETIME(),
    FlightJourneyDate DATE NOT NULL,
    DistanceKm DECIMAL(10,2) NOT NULL,
    BaseFare DECIMAL(18,2) NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Bookings_DiscountAmount DEFAULT 0,
    IdempotencyKey UNIQUEIDENTIFIER NULL,
    Taxes DECIMAL(18,2) NOT NULL,
    TicketPrice DECIMAL(18,2) NOT NULL,
    BookingStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_Bookings_BookingStatus DEFAULT N'Confirmed', -- Confirmed | Pending | Cancelled | Rescheduled | Failed
    PaymentStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_Bookings_PaymentStatus DEFAULT N'Paid',      -- Paid | Pending | Failed | Refunded
    CONSTRAINT PK_Bookings PRIMARY KEY CLUSTERED (BookingId ASC),
    CONSTRAINT UQ_Bookings_Reference UNIQUE NONCLUSTERED (BookingReference ASC),
    CONSTRAINT CK_Bookings_BookingStatus CHECK (BookingStatus IN (N'Confirmed', N'Pending', N'Cancelled', N'Rescheduled', N'Failed')),
    CONSTRAINT FK_Bookings_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION,
    CONSTRAINT FK_Bookings_Flights FOREIGN KEY (FlightId) REFERENCES dbo.Flights (FlightId) ON DELETE NO ACTION
);
GO
CREATE NONCLUSTERED INDEX IX_Bookings_UserId ON dbo.Bookings (UserId);
CREATE NONCLUSTERED INDEX IX_Bookings_UserId_BookingStatus ON dbo.Bookings (UserId, BookingStatus);
CREATE NONCLUSTERED INDEX IX_Bookings_FlightId ON dbo.Bookings (FlightId);
CREATE UNIQUE NONCLUSTERED INDEX UX_Bookings_User_IdempotencyKey
    ON dbo.Bookings (UserId, IdempotencyKey)
    WHERE IdempotencyKey IS NOT NULL;
GO

ALTER TABLE dbo.Coupons
    ADD CONSTRAINT FK_Coupons_GeneratedBooking
    FOREIGN KEY (GeneratedForBookingId) REFERENCES dbo.Bookings (BookingId) ON DELETE NO ACTION;
GO
CREATE UNIQUE NONCLUSTERED INDEX UX_Coupons_GeneratedForBookingId
    ON dbo.Coupons (GeneratedForBookingId)
    WHERE GeneratedForBookingId IS NOT NULL;
GO

-- ----------------------------------------------------------------------------
-- CouponUsage
-- ----------------------------------------------------------------------------
CREATE TABLE dbo.CouponUsage (
    CouponUsageId INT IDENTITY(1,1) NOT NULL,
    CouponId INT NOT NULL,
    UserId INT NOT NULL,
    BookingId INT NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL,
    UsedAt DATETIME2 NOT NULL CONSTRAINT DF_CouponUsage_UsedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_CouponUsage PRIMARY KEY CLUSTERED (CouponUsageId ASC),
    CONSTRAINT FK_CouponUsage_Coupons FOREIGN KEY (CouponId) REFERENCES dbo.Coupons (CouponId) ON DELETE NO ACTION,
    CONSTRAINT FK_CouponUsage_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION,
    CONSTRAINT FK_CouponUsage_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (BookingId) ON DELETE CASCADE
);
GO
-- A coupon can be redeemed by only one booking.
CREATE UNIQUE NONCLUSTERED INDEX UX_CouponUsage_CouponId ON dbo.CouponUsage (CouponId);
CREATE NONCLUSTERED INDEX IX_CouponUsage_UserId ON dbo.CouponUsage (UserId);
CREATE NONCLUSTERED INDEX IX_CouponUsage_BookingId ON dbo.CouponUsage (BookingId);
GO

-- ----------------------------------------------------------------------------
-- CouponTransactions: point earning and redemption ledger
-- ----------------------------------------------------------------------------
CREATE TABLE dbo.CouponTransactions (
    CouponTransactionId INT IDENTITY(1,1) NOT NULL,
    UserId INT NOT NULL,
    BookingId INT NOT NULL,
    TransactionType NVARCHAR(20) NOT NULL, -- Earned | Redeemed
    Points DECIMAL(18,4) NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_CouponTransactions_DiscountAmount DEFAULT 0,
    Status NVARCHAR(20) NOT NULL, -- Available | Pending | Redeemed | Cancelled
    TransactionDate DATETIME2 NOT NULL CONSTRAINT DF_CouponTransactions_TransactionDate DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_CouponTransactions PRIMARY KEY CLUSTERED (CouponTransactionId ASC),
    CONSTRAINT FK_CouponTransactions_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE NO ACTION,
    CONSTRAINT FK_CouponTransactions_Bookings FOREIGN KEY (BookingId) REFERENCES dbo.Bookings (BookingId) ON DELETE NO ACTION,
    CONSTRAINT CK_CouponTransactions_Points CHECK (Points > 0),
    CONSTRAINT CK_CouponTransactions_DiscountAmount CHECK (DiscountAmount >= 0),
    CONSTRAINT CK_CouponTransactions_Type CHECK (TransactionType IN (N'Earned', N'Redeemed')),
    CONSTRAINT CK_CouponTransactions_Status CHECK (Status IN (N'Available', N'Pending', N'Redeemed', N'Cancelled'))
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UX_CouponTransactions_Booking_Type
    ON dbo.CouponTransactions (BookingId, TransactionType);
CREATE NONCLUSTERED INDEX IX_CouponTransactions_User_Status_Type
    ON dbo.CouponTransactions (UserId, Status, TransactionType);
GO

PRINT 'FlightBooking_DB created. Start the backend once to seed the demo passengers.';
GO
