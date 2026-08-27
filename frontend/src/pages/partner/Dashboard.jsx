import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Users, Handshake, Wallet, TrendingUp, AlertCircle, UserCog } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/partner/dashboard").then((res) => setData(res.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Loading dashboard...</p>;
  if (!data) return null;

  const { stats, metricLabel, metricValue, partnerStatus, partnerRejectionReason, kycStatus, bankStatus, profileComplete, recentActivity, commissionTrend } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">Partner Status</span>
            <Badge status={partnerStatus} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">KYC Status</span>
            <Badge status={kycStatus} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">Bank Status</span>
            <Badge status={bankStatus} />
          </div>
        </div>
      </div>

      {partnerStatus === "rejected" && partnerRejectionReason && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{partnerRejectionReason}</span>
        </div>
      )}

      {!profileComplete && (
        <div className="flex items-start justify-between gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <div className="flex items-start gap-2">
            <UserCog size={16} className="shrink-0 mt-0.5" />
            <span>Your profile is incomplete — add your business details to move toward verification.</span>
          </div>
          <Link to="/partner/profile" className="font-semibold shrink-0 hover:underline">Complete Profile</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={metricLabel} value={metricValue} icon={Target} />
        <StatCard label="Total Leads" value={stats.totalLeads} icon={Users} />
        <StatCard label="Won Deals" value={stats.wonDeals} icon={Handshake} tone="brand" />
        <StatCard label="Pending Commission" value={`₹${stats.pendingCommission.toLocaleString()}`} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-brand-red" />
            <h2 className="font-semibold text-slate-900">Commission Trend</h2>
          </div>

          {commissionTrend.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">No commission history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={commissionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#EC2027" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.length === 0 && <p className="text-sm text-slate-400">Nothing yet.</p>}
            {recentActivity.map((a) => (
              <div key={a._id} className="text-sm">
                <p className="text-slate-700">{a.description}</p>
                <p className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
