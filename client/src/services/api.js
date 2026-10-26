import axios from 'axios';

// Support VITE_API_BASE_URL (full URL like https://api.example.com/api/v1) or VITE_API_URL (host like https://api.example.com)
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return import.meta.env.PROD
      ? 'https://imovie-skillwallet.onrender.com/api/v1'
      : 'http://localhost:5000/api/v1';
  }
  const clean = envUrl.trim().replace(/\/$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
};

const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s timeout to tolerate Render free tier cold-start spin-ups
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-IMovies-Client': '1'
  }
});

// Attach Bearer token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper for delay
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Response interceptor with Render cold-start retry and session expiration handling
api.interceptors.response.use(
  (response) => {
    // Notify UI that backend is actively responding
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('server-wake-up', { detail: { isWaking: false } }));
    }
    return response.data;
  },
  async (error) => {
    const config = error.config;
    
    // Check if error is candidate for Render cold-start retry (network down, timeout, 502/503/504 gateway spin-up)
    const isNetworkOrTimeout = !error.response || error.code === 'ECONNABORTED' || error.message?.includes('Network Error') || error.message?.includes('timeout');
    const isGatewayError = error.response && [502, 503, 504].includes(error.response.status);
    const shouldRetry = (isNetworkOrTimeout || isGatewayError) && config && (!config._retryCount || config._retryCount < 2);

    if (shouldRetry) {
      config._retryCount = (config._retryCount || 0) + 1;
      const maxRetries = 2;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('server-wake-up', {
            detail: {
              isWaking: true,
              message: `The cinema backend server is waking up from sleep. Automatically retrying (attempt ${config._retryCount}/${maxRetries})...`
            }
          })
        );
      }
      await wait(config._retryCount * 2500);
      return api(config);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('server-wake-up', { detail: { isWaking: false } }));
    }

    if (error.response?.status === 401) {
      // If unauthorized and has stored credentials, clear and redirect to login
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-expired'));
      }
    }

    let message = error.response?.data?.message || error.message || 'Network error occurred.';
    if (isNetworkOrTimeout || isGatewayError) {
      message = 'Cinema server is currently waking up or unreachable. Please wait a moment and try again.';
    }

    const enhancedError = new Error(message);
    enhancedError.response = error.response;
    enhancedError.code = error.response?.data?.code || error.code;
    enhancedError.data = error.response?.data;
    return Promise.reject(enhancedError);
  }
);
