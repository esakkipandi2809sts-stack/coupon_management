namespace FlightBookingBackend.DTOs
{
    public class DashboardStatisticsDto
    {
        public int AvailableCoupons { get; set; }
        public int PendingCoupons { get; set; }
        public int UsedCoupons { get; set; }
        public int TotalCoupons { get; set; }
        public int TotalBookings { get; set; }
        public int ConfirmedBookings { get; set; }
        public int AvailableFlights { get; set; }
        public int TotalUsers { get; set; }
        public decimal TotalRevenue { get; set; }
    }

    public class BookingStatisticsDto
    {
        public int TotalBookings { get; set; }
        public int CancelledBookings { get; set; }
        public int RescheduledBookings { get; set; }
        public int FailedBookings { get; set; }
    }

    public class RecentBookingDto
    {
        public int BookingId { get; set; }
        public string BookingReference { get; set; } = string.Empty;
        public string PassengerName { get; set; } = string.Empty;
        public string FlightNumber { get; set; } = string.Empty;
        public string Airline { get; set; } = string.Empty;
        public string Route { get; set; } = string.Empty;
        public DateTime BookingDate { get; set; }
        public decimal Amount { get; set; }
        public string BookingStatus { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string SeatNumber { get; set; } = string.Empty;
        public string Class { get; set; } = string.Empty;
    }
}
