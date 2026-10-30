USE FlightBooking_DB;
GO

-- STEP 1: Check flights with missing distance or price
SELECT
    FlightId,
    FlightNumber,
    Airline,
    FromCity,
    ToCity,
    DepartureDate,
    DistanceKm,
    Price
FROM dbo.Flights
WHERE DistanceKm IS NULL
   OR DistanceKm <= 0
   OR Price <= 0;
GO

-- STEP 2: Update verified route distance
UPDATE dbo.Flights
SET DistanceKm = 540.00
WHERE FlightNumber = N'KM-28';

-- STEP 3: Recalculate Economy fare using ₹4/km
UPDATE dbo.Flights
SET Price = ROUND(
    CASE
        WHEN DistanceKm * 4 < 1500 THEN 1500
        ELSE DistanceKm * 4
    END, 0
)
WHERE DistanceKm IS NOT NULL
  AND DistanceKm > 0;
GO

-- STEP 4: Verify updated fares
SELECT
    FlightId,
    FlightNumber,
    FromCity,
    ToCity,
    DistanceKm,
    Price
FROM dbo.Flights
ORDER BY FlightId DESC;
GO