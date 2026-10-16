using FlightBookingBackend.DTOs;

namespace FlightBookingBackend.Services
{
    public interface IFlightService
    {
        Task<IEnumerable<FlightDto>> GetAllFlightsAsync();
        Task<IEnumerable<FlightDto>> SearchFlightsAsync(FlightSearchQueryDto query);
        Task<IEnumerable<FlightDto>> GetFlightsByRouteAsync(string fromCity, string toCity);
        Task<IEnumerable<FlightDto>> SearchFlightsByRouteAsync(string from, string to, DateOnly date);
        Task<FlightDto?> GetFlightByIdAsync(int flightId);
        Task<bool> DeleteFlightAsync(int flightId);
        Task<IEnumerable<string>> GetUniqueCitiesAsync();
        Task<FlightSearchOptionsDto> GetSearchOptionsAsync();
        Task<FlightDto> CreateFlightAsync(CreateFlightDto dto);
        Task<FlightDto> CreateFlightAsync(CreateFlightDto dto, string creatorUserName);
        Task<ItineraryResultDto> CreateItineraryAsync(CreateItineraryDto request, string creatorUserName);
        Task<FlightDto?> UpdateFlightAsync(int flightId, CreateFlightDto dto);
    }
}
