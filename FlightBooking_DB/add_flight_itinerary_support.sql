/* ============================================================================
   Flight itinerary support: One Way / Round Trip / Multi-City + username-only creator.

   Safe to run more than once. Nothing is dropped or recreated, every existing
   flight and booking keeps its FlightId, and legacy rows become "OneWay".

   Adds to dbo.Flights:
     CreatedByUserName NVARCHAR(150) NULL      login name of the creator (string only, no FK)
     TripType          NVARCHAR(20)  NOT NULL  OneWay | RoundTrip | MultiCity (default OneWay)
     ItineraryId       UNIQUEIDENTIFIER NULL   shared by all segments of a round trip / multi-city itinerary
     SegmentOrder      INT NULL                1-based position inside the itinerary
   ============================================================================ */
SET QUOTED_IDENTIFIER ON;   -- required for filtered indexes when run through sqlcmd
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.Flights', N'CreatedByUserName') IS NULL
    ALTER TABLE dbo.Flights ADD CreatedByUserName NVARCHAR(150) NULL;

IF COL_LENGTH(N'dbo.Flights', N'TripType') IS NULL
    ALTER TABLE dbo.Flights ADD TripType NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Flights_TripType DEFAULT N'OneWay' WITH VALUES;

IF COL_LENGTH(N'dbo.Flights', N'ItineraryId') IS NULL
    ALTER TABLE dbo.Flights ADD ItineraryId UNIQUEIDENTIFIER NULL;

IF COL_LENGTH(N'dbo.Flights', N'SegmentOrder') IS NULL
    ALTER TABLE dbo.Flights ADD SegmentOrder INT NULL;
COMMIT TRANSACTION;
GO

/* If an earlier script added CreatedByUserId, copy the creator's username across once.
   The old column is left in place (nothing is dropped); the application no longer reads it. */
IF COL_LENGTH(N'dbo.Flights', N'CreatedByUserId') IS NOT NULL
BEGIN
    EXEC (N'
        UPDATE f
        SET f.CreatedByUserName = u.Username
        FROM dbo.Flights AS f
        INNER JOIN dbo.Users AS u ON u.Id = f.CreatedByUserId
        WHERE f.CreatedByUserName IS NULL;');
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'CK_Flights_TripType' AND parent_object_id = OBJECT_ID(N'dbo.Flights'))
    ALTER TABLE dbo.Flights WITH CHECK ADD CONSTRAINT CK_Flights_TripType
        CHECK (TripType IN (N'OneWay', N'RoundTrip', N'MultiCity'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Flights_ItineraryId' AND object_id = OBJECT_ID(N'dbo.Flights'))
    CREATE NONCLUSTERED INDEX IX_Flights_ItineraryId
        ON dbo.Flights (ItineraryId) WHERE ItineraryId IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'UX_Flights_Itinerary_Segment' AND object_id = OBJECT_ID(N'dbo.Flights'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Flights_Itinerary_Segment
        ON dbo.Flights (ItineraryId, SegmentOrder) WHERE ItineraryId IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Verification
   --------------------------------------------------------------------------- */
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = N'Flights'
  AND COLUMN_NAME IN (N'CreatedByUserName', N'TripType', N'ItineraryId', N'SegmentOrder');

-- Latest flights with their itinerary grouping and creator username.
SELECT TOP (30)
       FlightId, FlightNumber, FromCity, ToCity, DepartureDate, DepartureTime,
       DistanceKm, Price, TripType, ItineraryId, SegmentOrder, CreatedByUserName
FROM dbo.Flights
ORDER BY FlightId DESC;

-- Per-itinerary total fare (round trip and multi-city).
SELECT ItineraryId, TripType, COUNT(*) AS Segments, SUM(Price) AS TotalFare
FROM dbo.Flights
WHERE ItineraryId IS NOT NULL
GROUP BY ItineraryId, TripType
ORDER BY MAX(FlightId) DESC;
GO
