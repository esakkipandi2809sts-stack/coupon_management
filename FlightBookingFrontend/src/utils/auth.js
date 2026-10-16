// Authentication and Token utilities

const TOKEN_KEY = 'flight_token';
const USER_KEY = 'flight_user';

export const authUtil = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  getUser() {
    try {
      const userStr = localStorage.getItem(USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  getRole() {
    return this.getUser()?.role || 'User';
  },

  isAdmin() {
    return this.getRole().toLowerCase() === 'admin';
  },

  removeUser() {
    localStorage.removeItem(USER_KEY);
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Decode JWT payload safely
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return false;
      const decodedPayload = JSON.parse(atob(payloadBase64));

      if (decodedPayload.exp) {
        // exp is in seconds, convert to ms
        const isExpired = Date.now() >= decodedPayload.exp * 1000;
        if (isExpired) {
          this.clearSession();
          return false;
        }
      }
      return true;
    } catch {
      // If parsing fails, fall back to checking if token exists
      return true;
    }
  }
};
