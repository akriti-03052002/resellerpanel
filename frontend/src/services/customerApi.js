import axios from "axios";

// Customer-side axios instance. Attaches the customer JWT to every
// request and clears session + redirects to login on a 401.
const customerApi = axios.create({
  baseURL: `http://${window.location.hostname}:5000/api`,
  headers: {
    "Content-Type": "application/json"
  }
});

customerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("customerToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

customerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("customerToken");
      localStorage.removeItem("customer");

      if (!window.location.pathname.startsWith("/customer/login")) {
        window.location.href = "/customer/login";
      }
    }

    return Promise.reject(error);
  }
);

export default customerApi;
