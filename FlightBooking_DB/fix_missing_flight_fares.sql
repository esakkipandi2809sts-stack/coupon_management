-- Recalculate fares for flights with a verified route distance.
USE FlightBooking_DB;
GO

-- STEP 1: See which flights have no distance / price
SELECT FlightId, FlightNumber, Airline, FromCity, ToCity, DepartureDate, DistanceKm, Price
FROM dbo.Flights
WHERE DistanceKm IS NULL OR DistanceKm <= 0 OR Price <= 0;
GO

-- STEP 2: Set the real route distance (km) per flight (replace the placeholder value)
UPDATE dbo.Flights
SET DistanceKm = 540.00          -- <== put the real distance here
WHERE FlightNumber = N'KM-28';
GO

-- STEP 3: Recalculate Price (Economy fare = MAX(DistanceKm * 10, 1500))
UPDATE dbo.Flights
SET Price = CASE
    WHEN DistanceKm * 10 < 1500 THEN 1500
    ELSE ROUND(DistanceKm * 10, 2)
END
WHERE DistanceKm IS NOT NULL AND DistanceKm > 0;
GO

-- STEP 4: Verify
SELECT FlightId, FlightNumber, DistanceKm, Price
FROM dbo.Flights
WHERE DistanceKm IS NULL OR DistanceKm <= 0 OR Price <= 0;
GO
