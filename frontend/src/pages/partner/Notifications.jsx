import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/partner/notifications").then((res) => setNotifications(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await api.patch("/partner/notifications/read-all");
    load();
  };

  const markRead = async (id) => {
    await api.patch(`/partner/notifications/${id}/read`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <Button variant="outline" onClick={markAllRead}>Mark all as read</Button>
      </div>

      <Card className="divide-y divide-slate-100">
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-slate-400 text-sm p-6 text-center">No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <div key={n._id} className={`p-4 flex items-start gap-3 ${!n.read ? "bg-brand-red/5" : ""}`}>
              <Bell size={16} className="text-slate-400 mt-1 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{n.title}</p>
                <p className="text-sm text-slate-500">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.read && (
                <button onClick={() => markRead(n._id)} className="text-slate-400 hover:text-brand-red">
                  <Check size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
