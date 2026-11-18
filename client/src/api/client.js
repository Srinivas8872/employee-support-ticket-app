import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: Attach JWT token from localStorage if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Synchronize session invalidation on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Ignore login/register authentication failures (regular form validation errors)
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');

      if (!isAuthEndpoint) {
        // Guard against concurrent 401 bursts: only dispatch if a token was still present
        const hasActiveToken = !!localStorage.getItem('token');

        // Clear stored session tokens from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Dispatch event only once per expired session, avoiding redundant event cascades
        if (hasActiveToken && typeof window !== 'undefined') {
          const detailMessage =
            error.response?.data?.message || 'Your session has expired. Please sign in again.';
          window.dispatchEvent(
            new CustomEvent('auth:unauthorized', {
              detail: { message: detailMessage },
            })
          );
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  getMe: () => api.get('/auth/me'),
};

export const ticketApi = {
  getTickets: (params) => api.get('/tickets', { params }),
  getTicketById: (id) => api.get(`/tickets/${id}`),
  createTicket: (data) => api.post('/tickets', data),
  updateStatus: (id, status) => api.patch(`/tickets/${id}/status`, { status }),
  triageTicket: (id, data) => api.patch(`/tickets/${id}/triage`, data),
  getTimeline: (id) => api.get(`/tickets/${id}/timeline`),
  addComment: (id, content) => api.post(`/tickets/${id}/comments`, { content }),
};

export default api;
