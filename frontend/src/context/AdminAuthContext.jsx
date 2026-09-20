import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { onAuthEvent, ADMIN_LOGOUT_EVENT } from "../utils/authEvents";

const AdminAuthContext = createContext(null);

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(() => readStored("adminUser"));

  const setSession = useCallback((data) => {
    localStorage.setItem("adminToken", data.token);
    localStorage.setItem("adminUser", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    setUser(null);
  }, []);

  // Keeps route guards in sync when the session ends outside a normal
  // logout() call: an axios interceptor's 401 handler (same tab), or the
  // token being cleared in another tab.
  useEffect(() => {
    const unsubscribe = onAuthEvent(ADMIN_LOGOUT_EVENT, logout);

    const onStorage = (event) => {
      if (event.key === "adminToken" && !event.newValue) logout();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [logout]);

  return (
    <AdminAuthContext.Provider value={{ user, setSession, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminAuth = () => useContext(AdminAuthContext);
