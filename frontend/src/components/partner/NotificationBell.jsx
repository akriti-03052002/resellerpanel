import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/partner/notifications")
      .then((res) => setNotifications(res.data.data))
      .catch(() => toast.error("Failed to load notifications."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const recent = notifications.slice(0, 8);

  const markRead = async (id) => {
    await api.patch(`/partner/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.patch("/partner/notifications/read-all");
    load();
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-brand-black transition"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-brand-red border-2 border-white" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-brand-red hover:underline">
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <p className="text-sm text-slate-400 p-4">Loading...</p>
              ) : recent.length === 0 ? (
                <p className="text-sm text-slate-400 p-4 text-center">No notifications yet.</p>
              ) : (
                recent.map((n) => (
                  <div key={n._id} className={`p-3 flex items-start gap-2 ${!n.read ? "bg-brand-red/5" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.read && (
                      <button type="button" onClick={() => markRead(n._id)} className="shrink-0 text-slate-400 hover:text-brand-red" aria-label="Mark as read">
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <Link
              to="/partner/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-brand-red hover:underline px-4 py-3 border-t border-slate-100"
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
