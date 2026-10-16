/* ============================================================================
   Compare the dashboard "Booking Details" cards with the real data.
   Run it after using the app, then compare against the numbers on the dashboard.
   ============================================================================ */
USE FlightBooking_DB;   -- change if your database has a different name
GO

-- Administrator view (all bookings) - same query the API runs for an Admin
SELECT
    COUNT(*)                                                         AS TotalBookings,
    SUM(CASE WHEN BookingStatus = N'Cancelled'   THEN 1 ELSE 0 END)  AS CancelledBookings,
    SUM(CASE WHEN BookingStatus = N'Rescheduled' THEN 1 ELSE 0 END)  AS RescheduledBookings,
    SUM(CASE WHEN BookingStatus = N'Failed'      THEN 1 ELSE 0 END)  AS FailedBookings
FROM dbo.Bookings;

-- Passenger view (one row per user) - what each passenger sees on their own dashboard
SELECT
    u.Id AS UserId, u.Email,
    COUNT(b.BookingId)                                                AS TotalBookings,
    SUM(CASE WHEN b.BookingStatus = N'Cancelled'   THEN 1 ELSE 0 END) AS CancelledBookings,
    SUM(CASE WHEN b.BookingStatus = N'Rescheduled' THEN 1 ELSE 0 END) AS RescheduledBookings,
    SUM(CASE WHEN b.BookingStatus = N'Failed'      THEN 1 ELSE 0 END) AS FailedBookings
FROM dbo.Users AS u
LEFT JOIN dbo.Bookings AS b ON b.UserId = u.Id
GROUP BY u.Id, u.Email
ORDER BY u.Id;

-- Sanity check: every booking has exactly one status, so the buckets add up to the total.
SELECT BookingStatus, COUNT(*) AS Bookings
FROM dbo.Bookings
GROUP BY BookingStatus
ORDER BY BookingStatus;
