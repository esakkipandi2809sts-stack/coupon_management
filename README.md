# SkyWings - Flight Booking (coupon_management)

React + Vite frontend, ASP.NET Core Web API (EF Core, JWT) backend, SQL Server database.

```
coupon_management/
  FlightBooking_DB/            schema_and_seed.sql, upgrade_existing_database.sql, setup_database.ps1
  FlightBookingBackend/        ASP.NET Core API (http://localhost:6023)
  FlightBookingBackend.Tests/  xUnit tests
  FlightBookingFrontend/       React + Vite UI
```

## Run

1. Database (new install): run `FlightBooking_DB/schema_and_seed.sql` in SQL Server
   (or `./FlightBooking_DB/setup_database.ps1`). It creates `FlightBooking_DB` and all tables.
   For an existing database run `FlightBooking_DB/upgrade_existing_database.sql` instead
   (the backend also applies the additive upgrades at startup).
2. Backend: `dotnet run --project FlightBookingBackend` (http://localhost:6023, Swagger at `/swagger`).
   - A development-only JWT key is in `appsettings.Development.json`, so it starts out of the box.
     For any other environment set your own key (at least 32 bytes):
     `dotnet user-secrets set "Jwt:Key" "YOUR-RANDOM-32-BYTE-OR-LONGER-SECRET" --project FlightBookingBackend`
     or the `Jwt__Key` environment variable. Never put secrets in the frontend.
   - On first start, if the Users table is empty, three demo passengers are created
     (`john.doe@example.com`, `sarah.c@example.com`, `alex.j@example.com`, password `Password123!`).
3. Tests: `dotnet test FlightBookingBackend.Tests\FlightBookingBackend.Tests.csproj`
4. Frontend: `cd FlightBookingFrontend; npm install; npm run dev` (http://localhost:5173).
   To point at another API set `VITE_API_BASE_URL`.

## Login and flight availability

- Registration and login use the existing user accounts; new registrations receive the `User`
  role. The backend does not seed an Admin account or require a separate Admin login.
- Existing accounts retain their stored roles. Usernames are unique and the database continues
  to support the existing `Admin` and `User` role values for compatibility.
- Login accepts a username or email. Passwords are BCrypt-hashed and can be changed through the
  authenticated `PUT /api/users/change-password` endpoint.
- Flight listing, search, and creation require authentication. Any logged-in user can use Flight
  Management to create an availability record. Editing and deleting remain restricted to
  existing Admin-role operator accounts; deletion is rejected for flights that have bookings.
- Coupon operations remain passenger-scoped. Existing Admin-role accounts can view the
  read-only coupon overview; promo codes retain their pending, available, used, and expired lifecycle.

## Coupon rewards

- Every confirmed, paid booking earns points equal to the final paid booking amount divided by 100.
- Points and their associated booking/passenger are stored in the `CouponTransactions` SQL ledger.
  Ten points are worth ₹1; points can be redeemed in a later booking, capped at the remaining fare.
- Booking, point earning, and any point redemption are committed together in a serializable database
  transaction. Each booking can earn once and redeem once; a cancelled booking's unused earned points
  are cancelled, and cancellation is rejected if reversing those points would make the balance negative.
- The authenticated `GET /api/coupons/balance` endpoint reports available, pending, redeemed, and total
  points. Confirmed and paid bookings earn immediately, so pending points are currently zero.

## Fare rules

- Economy base fare = MAX(DistanceKm x 10, 1500); Business x1.5; First x2.2.
- The backend recalculates the class fare from the configured route distance when booking.
- A flight with no stored route distance shows "Fare unavailable" (never Rs 0.00) and cannot be booked.
- Legacy flights saved without a distance are repaired at backend startup: the distance is filled from
  the same supported-city table and formula used by the Flight Management form
  (great-circle distance x 1.1), and the economy fare is recalculated. Flights whose cities are not in
  that table are left as they are until an administrator enters a distance.

## Verification

- Backend unit tests cover authentication, booking/coupon workflows, and flight behavior.
- Flight and booking fare displays use the distance-based fare rule, consistent Indian Rupee
  formatting, and no default/fallback fares.
