// Lets axios interceptors (plain modules, no React tree access) tell the
// auth contexts "the session was just invalidated" so ProtectedRoute
// reacts immediately instead of only after a hard reload.
const bus = new EventTarget();

export const PARTNER_LOGOUT_EVENT = "partner:logout";
export const ADMIN_LOGOUT_EVENT = "admin:logout";

export const emitPartnerLogout = () => bus.dispatchEvent(new Event(PARTNER_LOGOUT_EVENT));
export const emitAdminLogout = () => bus.dispatchEvent(new Event(ADMIN_LOGOUT_EVENT));

export const onAuthEvent = (eventName, handler) => {
  bus.addEventListener(eventName, handler);
  return () => bus.removeEventListener(eventName, handler);
};
