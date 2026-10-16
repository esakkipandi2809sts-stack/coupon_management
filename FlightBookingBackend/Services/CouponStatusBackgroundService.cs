namespace FlightBookingBackend.Services
{
    public class CouponStatusBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<CouponStatusBackgroundService> _logger;
        private readonly TimeProvider _timeProvider;
        private readonly TimeZoneInfo _businessTimeZone;

        public CouponStatusBackgroundService(
            IServiceScopeFactory scopeFactory,
            ILogger<CouponStatusBackgroundService> logger,
            IConfiguration configuration,
            TimeProvider timeProvider)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _timeProvider = timeProvider;
            _businessTimeZone = CouponBusinessTime.ResolveTimeZone(
                configuration["Coupons:BusinessTimeZoneId"]);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var refreshSucceeded = false;
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var couponService = scope.ServiceProvider.GetRequiredService<ICouponService>();
                    await couponService.RefreshStatusesAsync();
                    refreshSucceeded = true;
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogError(ex, "Failed to refresh coupon statuses.");
                }

                var delay = refreshSucceeded
                    ? CouponBusinessTime.UntilNextDateBoundary(
                        _timeProvider.GetUtcNow(),
                        _businessTimeZone)
                    : TimeSpan.FromMinutes(1);
                try
                {
                    await Task.Delay(delay, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
            }
        }
    }
}
