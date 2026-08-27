import { createContext, useContext, useState, useCallback } from "react";

const PartnerAuthContext = createContext(null);

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function PartnerAuthProvider({ children }) {
  const [partner, setPartner] = useState(() => readStored("partner"));
  const [user, setUser] = useState(() => readStored("partnerUser"));

  const setSession = useCallback((data) => {
    localStorage.setItem("partnerToken", data.token);
    localStorage.setItem("partner", JSON.stringify(data.partner));
    localStorage.setItem("partnerUser", JSON.stringify(data.user));
    setPartner(data.partner);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("partnerToken");
    localStorage.removeItem("partner");
    localStorage.removeItem("partnerUser");
    setPartner(null);
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false;
      if (user.role === "owner") return true;
      return (user.permissions || []).includes(permission);
    },
    [user]
  );

  return (
    <PartnerAuthContext.Provider value={{ partner, user, setSession, logout, hasPermission }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePartnerAuth = () => useContext(PartnerAuthContext);
