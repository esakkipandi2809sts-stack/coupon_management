namespace FlightBookingBackend.Services
{
    public static class CouponBusinessTime
    {
        public const string DefaultTimeZoneId = "Asia/Kolkata";

        public static TimeZoneInfo ResolveTimeZone(string? timeZoneId)
        {
            var configuredTimeZoneId = string.IsNullOrWhiteSpace(timeZoneId)
                ? DefaultTimeZoneId
                : timeZoneId;

            return TimeZoneInfo.FindSystemTimeZoneById(configuredTimeZoneId);
        }

        public static DateOnly GetDate(DateTimeOffset utcNow, TimeZoneInfo timeZone)
        {
            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(utcNow, timeZone).DateTime);
        }

        public static TimeSpan UntilNextDateBoundary(DateTimeOffset utcNow, TimeZoneInfo timeZone)
        {
            var localNow = TimeZoneInfo.ConvertTime(utcNow, timeZone);
            var nextLocalMidnight = DateTime.SpecifyKind(
                localNow.Date.AddDays(1),
                DateTimeKind.Unspecified);
            var nextUtcMidnight = TimeZoneInfo.ConvertTimeToUtc(nextLocalMidnight, timeZone);
            var delay = nextUtcMidnight - utcNow.UtcDateTime;

            return delay > TimeSpan.Zero ? delay : TimeSpan.FromSeconds(1);
        }
    }
}
