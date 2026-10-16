/* Add creator tracking to an existing FlightBooking_DB database.
   Existing flights remain NULL because their original creator is unknown. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.Flights', N'CreatedByUserId') IS NULL
    ALTER TABLE dbo.Flights ADD CreatedByUserId INT NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Flights_Users_CreatedByUserId'
      AND parent_object_id = OBJECT_ID(N'dbo.Flights'))
BEGIN
    ALTER TABLE dbo.Flights WITH CHECK
      ADD CONSTRAINT FK_Flights_Users_CreatedByUserId
      FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users(Id);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Flights_CreatedByUserId'
      AND object_id = OBJECT_ID(N'dbo.Flights'))
    CREATE INDEX IX_Flights_CreatedByUserId ON dbo.Flights(CreatedByUserId);

COMMIT TRANSACTION;
GO

-- Verification: newly created flights should show the linked user's full name.
SELECT f.FlightId, f.FlightNumber, f.FromCity, f.ToCity,
       f.CreatedByUserId, u.Username, u.FullName AS CreatedByUserName
FROM dbo.Flights AS f
LEFT JOIN dbo.Users AS u ON u.Id = f.CreatedByUserId
ORDER BY f.FlightId DESC;
GO
