/* ============================================================================
   Booking status upgrade  (safe to run more than once)

   Adds support for the two new Bookings.BookingStatus values used by the
   dashboard "Booking Details" cards:

       Confirmed | Pending | Cancelled | Rescheduled | Failed

   No new columns or tables are needed - the existing BookingStatus column is reused.
   The backend also applies this automatically on startup (DbInitializer), so run this
   script only if you prefer to upgrade the database manually.
   ============================================================================ */
USE FlightBooking_DB;   -- change if your database has a different name
GO

-- 1. Show any statuses that are not supported (this must return no rows before the constraint is added).
SELECT BookingStatus, COUNT(*) AS Bookings
FROM dbo.Bookings
WHERE BookingStatus NOT IN (N'Confirmed', N'Pending', N'Cancelled', N'Rescheduled', N'Failed')
GROUP BY BookingStatus;
GO

-- 2. Fast per-user status counts for the dashboard.
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Bookings_UserId_BookingStatus' AND object_id = OBJECT_ID(N'dbo.Bookings'))
    CREATE NONCLUSTERED INDEX IX_Bookings_UserId_BookingStatus ON dbo.Bookings (UserId, BookingStatus);
GO

-- 3. Keep the status column consistent with the application.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_Bookings_BookingStatus' AND parent_object_id = OBJECT_ID(N'dbo.Bookings'))
   AND NOT EXISTS (SELECT 1 FROM dbo.Bookings
                   WHERE BookingStatus NOT IN (N'Confirmed', N'Pending', N'Cancelled', N'Rescheduled', N'Failed'))
    ALTER TABLE dbo.Bookings ADD CONSTRAINT CK_Bookings_BookingStatus
        CHECK (BookingStatus IN (N'Confirmed', N'Pending', N'Cancelled', N'Rescheduled', N'Failed'));
GO
