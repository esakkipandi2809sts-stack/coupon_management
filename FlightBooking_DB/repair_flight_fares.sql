-- Idempotent repair for flights with missing/invalid distance or fare.
-- Before running, replace the placeholder row with the real FlightNumber and
-- verified DistanceKm for each affected flight. Do not guess distances.

SELECT
    FlightId,
    FlightNumber,
    FromCity,
    ToCity,
    DistanceKm,
    Price
FROM dbo.Flights
WHERE DistanceKm IS NULL
   OR DistanceKm <= 0
   OR Price IS NULL
   OR Price <= 0
ORDER BY FlightNumber;

DECLARE @DistanceCorrections TABLE
(
    FlightNumber NVARCHAR(50) NOT NULL,
    DistanceKm DECIMAL(10, 2) NULL
);

INSERT INTO @DistanceCorrections (FlightNumber, DistanceKm)
VALUES
    (N'REPLACE_WITH_FLIGHT_NUMBER', NULL);

-- Replace the placeholder above with verified values, for example:
-- (N'AA123', 123.45)
UPDATE flight
SET flight.DistanceKm = correction.DistanceKm
FROM dbo.Flights AS flight
INNER JOIN @DistanceCorrections AS correction
    ON correction.FlightNumber = flight.FlightNumber
WHERE correction.DistanceKm IS NOT NULL
  AND correction.DistanceKm > 0
  AND (flight.DistanceKm IS NULL OR flight.DistanceKm <= 0);

UPDATE dbo.Flights
SET Price = CASE
    WHEN DistanceKm * 4 < 1500 THEN 1500
    ELSE ROUND(DistanceKm * 4, 0)
END
WHERE DistanceKm IS NOT NULL
  AND DistanceKm > 0
  AND (Price IS NULL OR Price <= 0 OR Price <> CASE
      WHEN DistanceKm * 4 < 1500 THEN 1500
      ELSE ROUND(DistanceKm * 4, 0)
  END);

-- After entering a verified correction for every affected flight, this query
-- returns zero rows when all flight distances and fares are valid.
SELECT
    FlightId,
    FlightNumber,
    FromCity,
    ToCity,
    DistanceKm,
    Price
FROM dbo.Flights
WHERE DistanceKm IS NULL
   OR DistanceKm <= 0
   OR Price IS NULL
   OR Price <= 0
ORDER BY FlightNumber;
