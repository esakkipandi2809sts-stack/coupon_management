USE FlightBooking_DB;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Older booking flows used Inactive for coupons earned from cancelled bookings.
-- Keep those records in the supported, non-redeemable status set.
IF OBJECT_ID(N'dbo.Coupons', N'U') IS NOT NULL
    UPDATE dbo.Coupons
    SET Status = N'Expired'
    WHERE Status = N'Inactive';

-- A coupon can be redeemed by only one successful booking.
IF OBJECT_ID(N'dbo.CouponUsage', N'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'UX_CouponUsage_CouponId'
         AND object_id = OBJECT_ID(N'dbo.CouponUsage'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_CouponUsage_CouponId
        ON dbo.CouponUsage (CouponId);
END;

COMMIT TRANSACTION;
GO
