-- ============================================================================
-- SkyWings Flight Booking - Upgrade script: Add Username to Coupons & User Coupon Counts
-- Database: FlightBooking_DB
-- ============================================================================

USE FlightBooking_DB;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- 1. Add Username column to dbo.Coupons
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Coupons', N'Username') IS NULL
BEGIN
    ALTER TABLE dbo.Coupons ADD Username NVARCHAR(150) NULL;
END;

-- Backfill Username on dbo.Coupons from dbo.Users
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    UPDATE c
    SET c.Username = u.Username
    FROM dbo.Coupons c
    INNER JOIN dbo.Users u ON c.UserId = u.Id
    WHERE c.Username IS NULL OR c.Username = N'';
END;

IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Coupons_Username' AND object_id = OBJECT_ID(N'dbo.Coupons'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Coupons_Username ON dbo.Coupons (Username);
END;

-- 2. Add per-user coupon status count columns to dbo.Users
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

-- 3. Create dbo.UserCouponCounts table to maintain separate coupon count details for each user
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

-- 4. Initial Synchronization of counts for all existing users
MERGE dbo.UserCouponCounts AS target
USING (
    SELECT 
        u.Id AS UserId,
        u.Username,
        ISNULL(SUM(CASE WHEN c.Status = N'Available' THEN 1 ELSE 0 END), 0) AS AvailableCoupons,
        ISNULL(SUM(CASE WHEN c.Status = N'Pending' THEN 1 ELSE 0 END), 0) AS PendingCoupons,
        ISNULL(SUM(CASE WHEN c.Status IN (N'Expired', N'Inactive') THEN 1 ELSE 0 END), 0) AS ExpiredCoupons,
        ISNULL(SUM(CASE WHEN c.Status = N'Used' THEN 1 ELSE 0 END), 0) AS UsedCoupons,
        ISNULL(SUM(CASE WHEN c.Status IN (N'Available', N'Pending', N'Expired', N'Inactive', N'Used') THEN 1 ELSE 0 END), 0) AS TotalCoupons
    FROM dbo.Users u
    LEFT JOIN dbo.Coupons c ON u.Id = c.UserId 
        AND c.Status <> N'Cancelled'
        AND (c.GeneratedForBookingId IS NULL OR NOT EXISTS (
            SELECT 1 FROM dbo.Bookings b WHERE b.BookingId = c.GeneratedForBookingId AND b.BookingStatus = N'Cancelled'
        ))
    GROUP BY u.Id, u.Username
) AS src
ON target.UserId = src.UserId
WHEN MATCHED THEN
    UPDATE SET 
        target.Username = src.Username,
        target.AvailableCoupons = src.AvailableCoupons,
        target.PendingCoupons = src.PendingCoupons,
        target.ExpiredCoupons = src.ExpiredCoupons,
        target.UsedCoupons = src.UsedCoupons,
        target.TotalCoupons = src.TotalCoupons,
        target.LastUpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (UserId, Username, AvailableCoupons, PendingCoupons, ExpiredCoupons, UsedCoupons, TotalCoupons, LastUpdatedAt)
    VALUES (src.UserId, src.Username, src.AvailableCoupons, src.PendingCoupons, src.ExpiredCoupons, src.UsedCoupons, src.TotalCoupons, SYSUTCDATETIME());

-- Update columns on Users table as well
UPDATE u
SET 
    u.AvailableCoupons = ucc.AvailableCoupons,
    u.PendingCoupons = ucc.PendingCoupons,
    u.ExpiredCoupons = ucc.ExpiredCoupons,
    u.UsedCoupons = ucc.UsedCoupons,
    u.TotalCoupons = ucc.TotalCoupons
FROM dbo.Users u
INNER JOIN dbo.UserCouponCounts ucc ON u.Id = ucc.UserId;

COMMIT TRANSACTION;
GO
