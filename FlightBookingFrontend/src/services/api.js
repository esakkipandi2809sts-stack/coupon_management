import axios from 'axios';
import { authUtil } from '../utils/auth';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: attach JWT bearer token if available
api.interceptors.request.use(
  (config) => {
    const token = authUtil.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthenticated & token expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      authUtil.clearSession();
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
};

// Flights endpoints
export const flightApi = {
  getAll: () => api.get('/flights'),
  search: ({ fromCity, toCity, departureDate, ...filters }) =>
    api.get('/flights/search', { params: { fromCity, toCity, departureDate, ...filters } }),
  getByRoute: (fromCity, toCity) =>
    api.get('/flights/route', { params: { fromCity, toCity } }),
  searchByRoute: (from, to, date) => api.get(`/flights/search/${encodeURIComponent(from)}/${encodeURIComponent(to)}/${date}`),
  getById: (id) => api.get(`/flights/${id}`),
  getCities: () => api.get('/flights/cities'),
  getSearchOptions: () => api.get('/flights/search-options'),
  create: (flightData) => api.post('/flights', flightData),
  // One Way (1 segment), Round Trip (2) or Multi-City (2-6): { tripType, segments: [...] }
  createItinerary: (itineraryData) => api.post('/flights/itinerary', itineraryData),
  update: (id, flightData) => api.put(`/flights/${id}`, flightData),
  delete: (id) => api.delete(`/flights/${id}`),
};

// Bookings endpoints
export const bookingApi = {
  create: (bookingData) => api.post('/bookings', bookingData),
  getMyBookings: () => api.get('/bookings/my'),
  getById: (id) => api.get(`/bookings/${id}`),
  cancel: (id) => api.put(`/bookings/${id}/cancel`),
  reschedule: (id, { newFlightId, seatNumber }) =>
    api.put(`/bookings/${id}/reschedule`, { newFlightId, seatNumber }),
};

// Coupons endpoints
export const couponApi = {
  getAll: () => api.get('/coupons/my-coupons'),
  getAllForAdmin: () => api.get('/coupons/admin'),
  getAvailable: () => api.get('/coupons/available'),
  getEligibility: () => api.get('/coupons/eligibility'),
  getBalance: () => api.get('/coupons/balance'),
  validate: (couponCode, flightId, flightClass, passengerCount = 1) =>
    api.post('/coupons/validate', { couponCode, flightId, class: flightClass, passengerCount }),
  getStatistics: () => api.get('/coupons/summary'),
  getAdminStatistics: () => api.get('/coupons/admin/summary'),
};

// Dashboard endpoints
export const dashboardApi = {
  getStatistics: () => api.get('/dashboard/statistics'),
  getBookingStatistics: () => api.get('/dashboard/booking-statistics'),
  getRecentBookings: (count = 10) => api.get(`/dashboard/recent-bookings?count=${count}`),
};

// User Profile endpoints
export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (profileData) => api.put('/users/profile', profileData),
  changePassword: (passwordData) => api.put('/users/change-password', passwordData),
};

export default api;
