
import axios from 'axios';
import { authUtil } from '../utils/auth';

// Read backend API URL from frontend .env file
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

console.log('API Base URL:', API_BASE_URL);

if (!API_BASE_URL) {
  console.error(
    'VITE_API_BASE_URL is missing. Please configure it in your frontend .env file.'
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach JWT token to requests when available
api.interceptors.request.use(
  (config) => {
    const token = authUtil.getToken();

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authUtil.clearSession();

      const currentPath = window.location.pathname;
      const isAuthPage =
        currentPath.includes('/login') ||
        currentPath.includes('/register');

      if (!isAuthPage) {
        window.location.href = '/login?expired=true';
      }
    }

    return Promise.reject(error);
  }
);

// Authentication APIs
// Backend: AuthController with [Route("api/[controller]")]

export const authApi = {
  register: (userData) => api.post('/Auth/register', userData),
  login: (credentials) => api.post('/Auth/login', credentials),
};


// Flight APIs
export const flightApi = {
  getAll: () => api.get('/flights'),

  search: ({ fromCity, toCity, departureDate, ...filters }) =>
    api.get('/flights/search', {
      params: { fromCity, toCity, departureDate, ...filters },
    }),

  getByRoute: (fromCity, toCity) =>
    api.get('/flights/route', {
      params: { fromCity, toCity },
    }),

  searchByRoute: (from, to, date) =>
    api.get(
      `/flights/search/${encodeURIComponent(from)}/${encodeURIComponent(to)}/${date}`
    ),

  getById: (id) => api.get(`/flights/${id}`),

  getBookedSeats: (id) => api.get(`/flights/${id}/booked-seats`),

  getCities: () => api.get('/flights/cities'),

  getSearchOptions: () => api.get('/flights/search-options'),

  create: (flightData) => api.post('/flights', flightData),

  // One Way, Round Trip, or Multi-City itinerary
  createItinerary: (itineraryData) =>
    api.post('/flights/itinerary', itineraryData),

  update: (id, flightData) =>
    api.put(`/flights/${id}`, flightData),

  delete: (id) => api.delete(`/flights/${id}`),
};

// Booking APIs
export const bookingApi = {
  create: (bookingData) => api.post('/bookings', bookingData),

  getMyBookings: () => api.get('/bookings/my'),

  getById: (id) => api.get(`/bookings/${id}`),

  cancel: (id) => api.put(`/bookings/${id}/cancel`),

  reschedule: (id, { newFlightId, seatNumber }) =>
    api.put(`/bookings/${id}/reschedule`, {
      newFlightId,
      seatNumber,
    }),

  rescheduleDirect: (id) => api.put(`/bookings/${id}/reschedule-direct`),
};

// Coupon APIs
export const couponApi = {
  getAll: () => api.get('/coupons/my-coupons'),

  getAllForAdmin: () => api.get('/coupons/admin'),

  getAvailable: () => api.get('/coupons/available'),

  getEligibility: () => api.get('/coupons/eligibility'),

  getBalance: () => api.get('/coupons/balance'),

  validate: (couponCode, flightId, flightClass, passengerCount = 1) =>
    api.post('/coupons/validate', {
      couponCode,
      flightId,
      class: flightClass,
      passengerCount,
    }),

  getStatistics: () => api.get('/coupons/summary'),

  getAdminStatistics: () => api.get('/coupons/admin/summary'),

  createFromPoints: (points) =>
    api.post('/coupons/create-from-points', { points }),
};

// Dashboard APIs
export const dashboardApi = {
  getStatistics: () => api.get('/dashboard/statistics'),

  getBookingStatistics: () =>
    api.get('/dashboard/booking-statistics'),

  getRecentBookings: (count = 10) =>
    api.get('/dashboard/recent-bookings', {
      params: { count },
    }),
};

// User Profile APIs
export const userApi = {
  getProfile: () => api.get('/users/profile'),

  updateProfile: (profileData) =>
    api.put('/users/profile', profileData),

  changePassword: (passwordData) =>
    api.put('/users/change-password', passwordData),
};

export default api;
