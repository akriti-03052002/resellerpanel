import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { onAuthEvent, PARTNER_LOGOUT_EVENT } from "../utils/authEvents";

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

  // Keeps route guards in sync when the session ends outside a normal
  // logout() call: an axios interceptor's 401 handler (same tab), or the
  // token being cleared in another tab.
  useEffect(() => {
    const unsubscribe = onAuthEvent(PARTNER_LOGOUT_EVENT, logout);

    const onStorage = (event) => {
      if (event.key === "partnerToken" && !event.newValue) logout();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [logout]);

  return (
    <PartnerAuthContext.Provider value={{ partner, user, setSession, logout, hasPermission }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePartnerAuth = () => useContext(PartnerAuthContext);
