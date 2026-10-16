/* Run this once against the existing FlightBooking SQL Server database. */
IF COL_LENGTH('dbo.Bookings', 'PassengerCount') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings
    ADD PassengerCount INT NOT NULL
        CONSTRAINT DF_Bookings_PassengerCount DEFAULT (1) WITH VALUES;
END;
GO

/* Existing rows remain one passenger; new bookings save the requested count. */
SELECT TOP (20)
    BookingId,
    [Class],
    PassengerCount,
    BaseFare,
    DiscountAmount,
    TicketPrice
FROM dbo.Bookings
ORDER BY BookingId DESC;
GO
