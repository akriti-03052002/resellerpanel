import { createContext, useContext, useState, useCallback } from "react";

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

  return (
    <AdminAuthContext.Provider value={{ user, setSession, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminAuth = () => useContext(AdminAuthContext);
