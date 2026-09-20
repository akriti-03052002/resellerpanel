import axios from "axios";
import { emitPartnerLogout } from "../utils/authEvents";

// Partner-side axios instance. Attaches the partner JWT to every
// request and clears session + redirects to login on a 401.
// VITE_API_URL lets prod point at a real domain/port; falls back to the
// current hostname on :5000 so LAN dev access (Vite's "Network" URL) keeps
// working without an .env override.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("partnerToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("partnerToken");
      localStorage.removeItem("partner");
      localStorage.removeItem("partnerUser");
      // Tells PartnerAuthContext right away so ProtectedRoute re-renders via
      // React state instead of relying only on the hard redirect below.
      emitPartnerLogout();

      if (!window.location.pathname.startsWith("/partner/login")) {
        window.location.href = "/partner/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
