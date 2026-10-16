# Dynamic Flight Fare Update

## Implemented

- Traveller classes: All, Economy, Premium Economy, Business, First.
- Multipliers: Economy 1.0x, Premium Economy 1.3x, Business 1.5x, First 2.2x.
- `All` is a search selection only and becomes Economy when a booking is submitted.
- Shared frontend fare helpers are in `FlightBookingFrontend/src/utils/flightPricing.js`.
- Availability cards display the selected class fare and total for the selected passenger count.
- Booking checkout displays base fare, selected class, multiplier, passenger count, discounts, and final payable amount.
- The booking API recalculates class fare from the database-stored flight base fare and passenger count. It does not trust the frontend amount.
- Coupon validation uses the selected class and passenger count. Existing fixed/percentage coupon rules are retained.
- Booking records store the selected class, passenger count, pre-discount total fare, discount, and final ticket price.

## Required SQL Server update

Before running the updated backend against an existing database, execute this script against the same FlightBooking database:

`FlightBooking_DB/upgrade_dynamic_fare_passenger_count.sql`

It adds `PassengerCount` to `dbo.Bookings` with a default of 1 for existing bookings.

## Run the project

1. Run the SQL script above.
2. Start the ASP.NET Core backend using the existing project settings.
3. In `FlightBookingFrontend`, run `npm install` if dependencies are not installed, then `npm run dev`.

## Verification note

The modified JSX/JavaScript files were syntax-checked. A full frontend production build and .NET build could not be run in this environment because frontend packages and the .NET SDK were not available here.
