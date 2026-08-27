import axios from "axios";

// Partner-side axios instance. Attaches the partner JWT to every
// request and clears session + redirects to login on a 401.
const api = axios.create({
  baseURL: `http://${window.location.hostname}:5000/api`,
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

      if (!window.location.pathname.startsWith("/partner/login")) {
        window.location.href = "/partner/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
