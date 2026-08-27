import axios from "axios";

/**
 * Konfigurasi Axios Sentral
 * Mengambil Base URL dari environment variables atau fallback ke localhost.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
  // Batas waktu request, misalnya 15 detik (berguna jika GA butuh komputasi lama)
  timeout: 15000,
});

/**
 * Interceptor untuk Request
 * Berguna jika nantinya Anda mengimplementasikan sistem Login (JWT/Bearer Token)
 */
apiClient.interceptors.request.use(
  (config) => {
    // Contoh jika ada token:
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Interceptor untuk Response
 * Berguna untuk menangani error global, misalnya token expired -> otomatis logout
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Tangkap error secara global agar rapi
    console.error("[API Error]:", error.response?.data || error.message);

    // Jika perlu handling spesifik misal error 401:
    // if (error.response?.status === 401) {
    //   window.location.href = '/login';
    // }

    return Promise.reject(error);
  },
);

export default apiClient;
