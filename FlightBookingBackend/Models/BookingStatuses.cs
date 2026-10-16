namespace FlightBookingBackend.Models
{
    /// <summary>
    /// Every value allowed in <c>Bookings.BookingStatus</c>. A booking holds exactly one
    /// status at a time, so the dashboard counts below can never double-count a booking.
    /// </summary>
    public static class BookingStatuses
    {
        public const string Confirmed = "Confirmed";
        public const string Pending = "Pending";
        public const string Cancelled = "Cancelled";
        public const string Rescheduled = "Rescheduled";
        public const string Failed = "Failed";

        public static readonly string[] All = { Confirmed, Pending, Cancelled, Rescheduled, Failed };
    }
}
