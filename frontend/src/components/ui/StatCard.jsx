import Card from "./Card";

export default function StatCard({ label, value, icon: Icon, tone = "default" }) {
  const iconTone = tone === "brand" ? "bg-brand-red/10 text-brand-red" : "bg-slate-100 text-slate-700";

  return (
    <Card className="p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      </div>
      {Icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconTone}`}>
          <Icon size={20} />
        </div>
      )}
    </Card>
  );
}
