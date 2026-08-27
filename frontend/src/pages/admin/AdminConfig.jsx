import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";

const TABS = ["Programs", "Tiers", "Commission Rules", "Screen Pricing"];
const PARTNER_TYPES = ["vendor", "influencer", "affiliate", "referral", "agency", "reseller", "technology", "strategic"];

// A program is a limited-time campaign, not a permanent category — this
// figures out whether it's currently joinable so the table doesn't just
// say "active" for something whose window already closed.
function programWindowStatus(program) {
  if (program.status !== "active") return { label: program.status, tone: "neutral" };

  const now = new Date();
  if (program.startDate && now < new Date(program.startDate)) return { label: "upcoming", tone: "info" };
  if (program.endDate && now > new Date(program.endDate)) return { label: "expired", tone: "danger" };

  return { label: "active", tone: "success" };
}

const DEFAULT_PROGRAM_FORM = {
  name: "", code: "", type: "vendor", description: "", bannerHeadline: "",
  isPublic: true, startDate: "", endDate: "", status: "draft",
  incentiveDescription: "", bonusAmount: 0, startingTierId: ""
};

function ProgramsTab() {
  const [programs, setPrograms] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [form, setForm] = useState(DEFAULT_PROGRAM_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => adminApi.get("/admin/config/programs").then((res) => setPrograms(res.data.data));
  useEffect(() => { load(); adminApi.get("/admin/config/tiers").then((res) => setTiers(res.data.data)); }, []);

  const tiersForType = tiers.filter((t) => t.partnerType === form.type);

  const startCreate = () => {
    setForm(DEFAULT_PROGRAM_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (program) => {
    setForm({
      name: program.name || "",
      code: program.code || "",
      type: program.type || "vendor",
      description: program.description || "",
      bannerHeadline: program.bannerHeadline || "",
      isPublic: program.isPublic ?? true,
      startDate: program.startDate ? program.startDate.slice(0, 10) : "",
      endDate: program.endDate ? program.endDate.slice(0, 10) : "",
      status: program.status || "draft",
      incentiveDescription: program.incentive?.description || "",
      bonusAmount: program.incentive?.bonusAmount || 0,
      startingTierId: program.incentive?.startingTierId || ""
    });
    setEditingId(program._id);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      name: form.name,
      code: form.code,
      type: form.type,
      description: form.description,
      bannerHeadline: form.bannerHeadline,
      isPublic: form.isPublic,
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      incentive: {
        description: form.incentiveDescription,
        bonusAmount: Number(form.bonusAmount) || 0,
        startingTierId: form.startingTierId || undefined
      }
    };
    try {
      if (editingId) {
        await adminApi.patch(`/admin/config/programs/${editingId}`, payload);
      } else {
        await adminApi.post("/admin/config/programs", payload);
      }
      setForm(DEFAULT_PROGRAM_FORM);
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || `Something went wrong ${editingId ? "updating" : "creating"} the program.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => (showForm ? setShowForm(false) : startCreate())}>{showForm ? "Cancel" : "New Program"}</Button></div>

      {showForm && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Founding Partner Drive 2026" />
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="FOUNDING2026" />
            <Select label="Partner Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, startingTierId: "" })}>
              {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft (not visible yet)</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Input label="Starts" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Ends (blank = open-ended)" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <Input label="Banner Headline" value={form.bannerHeadline} onChange={(e) => setForm({ ...form, bannerHeadline: e.target.value })} placeholder="Shown on the public landing page" className="md:col-span-2" />
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="md:col-span-2" />

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
              Show on the public landing page while active
            </label>

            <div className="md:col-span-2 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Signup incentive (optional)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Incentive description" value={form.incentiveDescription} onChange={(e) => setForm({ ...form, incentiveDescription: e.target.value })} placeholder="Instant Certified-tier pricing + ₹5,000 bonus" />
                <Input label="Signup bonus (₹, 0 = none)" type="number" value={form.bonusAmount} onChange={(e) => setForm({ ...form, bonusAmount: e.target.value })} />
                <Select label="Starting tier (optional)" value={form.startingTierId} onChange={(e) => setForm({ ...form, startingTierId: e.target.value })}>
                  <option value="">Default (base tier)</option>
                  {tiersForType.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </Select>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              {editingId && <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>}
              <Button type="submit" loading={saving}>{editingId ? "Save Changes" : "Create"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table
          empty="No programs yet."
          rows={programs}
          columns={[
            { key: "name", header: "Name" },
            { key: "type", header: "Type", render: (p) => <Badge tone="neutral">{p.type}</Badge> },
            { key: "window", header: "Window", render: (p) => { const w = programWindowStatus(p); return <Badge tone={w.tone}>{w.label}</Badge>; } },
            { key: "bonus", header: "Bonus", render: (p) => (p.incentive?.bonusAmount ? `₹${p.incentive.bonusAmount.toLocaleString()}` : "—") },
            { key: "public", header: "Public", render: (p) => (p.isPublic ? "Yes" : "No") },
            { key: "actions", header: "", render: (p) => <button type="button" onClick={() => startEdit(p)} className="text-sm font-semibold text-brand-red hover:underline">Edit</button> }
          ]}
        />
      </Card>
    </div>
  );
}

const DEFAULT_TIER_FORM = { partnerType: "vendor", programId: "", name: "", code: "", level: 1, commissionRate: 0, metricLabel: "", minMetric: 0, maxMetric: "", perks: "" };

// Vendor/Reseller tiers pay a percentage; every other type's placeholder
// ladders store a flat rupee amount in the same benefits.commissionRate
// field (see seedTiers.js) — label it honestly so editing doesn't imply
// the wrong unit.
const isPercentageType = (partnerType) => partnerType === "vendor" || partnerType === "reseller";

function TiersTab() {
  const [tiers, setTiers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(DEFAULT_TIER_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.get("/admin/config/tiers").then((res) => setTiers(res.data.data));
  useEffect(() => { load(); adminApi.get("/admin/config/programs").then((res) => setPrograms(res.data.data)); }, []);

  const startCreate = () => {
    setForm(DEFAULT_TIER_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (tier) => {
    const metric = tier.qualification?.metric;
    setForm({
      partnerType: tier.partnerType || "vendor",
      programId: tier.programId || "",
      name: tier.name || "",
      code: tier.code || "",
      level: tier.level ?? 1,
      commissionRate: tier.benefits?.commissionRate ?? 0,
      metricLabel: metric?.label || (tier.qualification?.screenCount ? "Screens installed" : ""),
      minMetric: metric?.min ?? tier.qualification?.screenCount?.min ?? 0,
      maxMetric: (metric?.max ?? tier.qualification?.screenCount?.max) ?? "",
      perks: (tier.benefits?.perks || []).join(", ")
    });
    setEditingId(tier._id);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      partnerType: form.partnerType,
      programId: form.programId || undefined,
      name: form.name,
      code: form.code,
      level: Number(form.level),
      qualification: {
        metric: {
          label: form.metricLabel,
          min: Number(form.minMetric) || 0,
          max: form.maxMetric === "" ? null : Number(form.maxMetric)
        }
      },
      benefits: {
        commissionRate: Number(form.commissionRate),
        perks: form.perks.split(",").map((p) => p.trim()).filter(Boolean)
      }
    };
    try {
      if (editingId) {
        await adminApi.patch(`/admin/config/tiers/${editingId}`, payload);
      } else {
        await adminApi.post("/admin/config/tiers", payload);
      }
      setForm(DEFAULT_TIER_FORM);
      setEditingId(null);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => (showForm ? setShowForm(false) : startCreate())}>{showForm ? "Cancel" : "New Tier"}</Button></div>

      {showForm && (
        <Card className="p-6">
          <p className="text-xs text-slate-400 mb-4">
            Only Vendor and Reseller commission types are unambiguous enough to auto-create/auto-sync the matching
            Commission Rule when you save this tier. For other partner types, update the rate/fee manually in the
            Commission Rules tab too — the number on this tier is display-only for them.
          </p>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Partner Type" value={form.partnerType} onChange={(e) => setForm({ ...form, partnerType: e.target.value })} required>
              {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Program (optional)" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
              <option value="">No program — standalone tier</option>
              {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </Select>
            <Input label="Level" type="number" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} required />
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Gold" />
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              placeholder={form.partnerType === "vendor" ? "GOLD" : `${form.partnerType.toUpperCase()}-GOLD`}
            />
            <Input label="Qualifying Metric" value={form.metricLabel} onChange={(e) => setForm({ ...form, metricLabel: e.target.value })} placeholder="Leads referred / Screens installed / Volume purchased" />
            <Input label="Min Threshold" type="number" value={form.minMetric} onChange={(e) => setForm({ ...form, minMetric: e.target.value })} />
            <Input label="Max Threshold (blank = no cap)" type="number" value={form.maxMetric} onChange={(e) => setForm({ ...form, maxMetric: e.target.value })} />
            <Input
              label={isPercentageType(form.partnerType) ? "Commission / Discount Rate (%)" : "Flat Fee Amount (₹)"}
              type="number"
              value={form.commissionRate}
              onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
            />
            <Input label="Perks (comma-separated)" value={form.perks} onChange={(e) => setForm({ ...form, perks: e.target.value })} placeholder="Dedicated support, Co-marketing" className="md:col-span-2" />
            <div className="md:col-span-2 flex justify-end gap-2">
              {editingId && <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>}
              <Button type="submit" loading={saving}>{editingId ? "Save Changes" : "Create"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table
          empty="No tiers yet."
          rows={tiers}
          columns={[
            { key: "type", header: "Type", render: (t) => <Badge tone="neutral">{t.partnerType || "—"}</Badge> },
            { key: "name", header: "Name" },
            {
              key: "metric",
              header: "Qualifies On",
              render: (t) => {
                const metric = t.qualification?.metric;
                const label = metric?.label || (t.qualification?.screenCount ? "Screens installed" : "");
                const min = metric?.min ?? t.qualification?.screenCount?.min ?? 0;
                const max = metric?.max ?? t.qualification?.screenCount?.max;
                return label ? `${label}: ${min}+${max ? ` – ${max}` : ""}` : "—";
              }
            },
            { key: "rate", header: "Rate", render: (t) => (isPercentageType(t.partnerType) ? `${t.benefits?.commissionRate ?? 0}%` : `₹${(t.benefits?.commissionRate ?? 0).toLocaleString()}`) },
            { key: "perks", header: "Perks", render: (t) => (t.benefits?.perks || []).join(", ") || "—" },
            { key: "status", header: "Status", render: (t) => <Badge status={t.status} /> },
            { key: "actions", header: "", render: (t) => <button type="button" onClick={() => startEdit(t)} className="text-sm font-semibold text-brand-red hover:underline">Edit</button> }
          ]}
        />
      </Card>
    </div>
  );
}

const COMMISSION_TYPE_OPTIONS = ["percentage", "fixed_per_deal", "fixed_per_screen", "recurring_percentage", "recurring_fixed", "hybrid", "wholesale_discount"];

// Mirrors computeGrossCommission in backend/services/commissionEngine.js —
// each commission type only ever reads one of these field groups, so only
// the matching field(s) should be editable for a given type.
const RATE_TYPES = ["percentage", "recurring_percentage", "wholesale_discount"];
const FIXED_TYPES = ["fixed_per_deal", "recurring_fixed"];
const PER_SCREEN_TYPES = ["fixed_per_screen"];

const DEFAULT_RULE_FORM = {
  name: "", partnerType: "", tierId: "", isAddOn: false,
  commissionType: "percentage", rate: 0, fixedAmount: 0, perScreenAmount: 0,
  hybridPercentageRate: 0, hybridFixedAmount: 0, hybridPerScreenAmount: 0,
  recurringEnabled: false, durationType: "months", duration: 6
};

function CommissionRulesTab() {
  const [rules, setRules] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [form, setForm] = useState(DEFAULT_RULE_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.get("/admin/config/commission-rules").then((res) => setRules(res.data.data));
  useEffect(() => { load(); adminApi.get("/admin/config/tiers").then((res) => setTiers(res.data.data)); }, []);

  const startCreate = () => {
    setForm(DEFAULT_RULE_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (rule) => {
    setForm({
      name: rule.name || "",
      partnerType: rule.partnerType || "",
      tierId: rule.tierId || "",
      isAddOn: rule.isAddOn || false,
      commissionType: rule.commissionType || "percentage",
      rate: rule.rate || 0,
      fixedAmount: rule.fixedAmount || 0,
      perScreenAmount: rule.perScreenAmount || 0,
      hybridPercentageRate: rule.hybrid?.percentageRate || 0,
      hybridFixedAmount: rule.hybrid?.fixedAmount || 0,
      hybridPerScreenAmount: rule.hybrid?.perScreenAmount || 0,
      recurringEnabled: rule.recurring?.enabled || false,
      durationType: rule.recurring?.durationType || "months",
      duration: rule.recurring?.duration || 6
    });
    setEditingId(rule._id);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      partnerType: form.partnerType || undefined,
      tierId: form.isAddOn ? undefined : (form.tierId || undefined),
      isAddOn: form.isAddOn,
      commissionType: form.commissionType,
      rate: RATE_TYPES.includes(form.commissionType) ? Number(form.rate) : 0,
      fixedAmount: FIXED_TYPES.includes(form.commissionType) ? Number(form.fixedAmount) : 0,
      perScreenAmount: PER_SCREEN_TYPES.includes(form.commissionType) ? Number(form.perScreenAmount) : 0,
      hybrid: form.commissionType === "hybrid"
        ? {
            percentageRate: Number(form.hybridPercentageRate),
            fixedAmount: Number(form.hybridFixedAmount),
            perScreenAmount: Number(form.hybridPerScreenAmount)
          }
        : undefined,
      recurring: form.recurringEnabled
        ? { enabled: true, durationType: form.durationType, duration: Number(form.duration) }
        : { enabled: false, durationType: "none" }
    };
    try {
      if (editingId) {
        await adminApi.patch(`/admin/config/commission-rules/${editingId}`, payload);
      } else {
        await adminApi.post("/admin/config/commission-rules", payload);
      }
      setForm(DEFAULT_RULE_FORM);
      setEditingId(null);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => (showForm ? setShowForm(false) : startCreate())}>{showForm ? "Cancel" : "New Rule"}</Button></div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Rule Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Select label="Partner Type (optional)" value={form.partnerType} onChange={(e) => setForm({ ...form, partnerType: e.target.value })}>
              <option value="">Any</option>
              {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={form.isAddOn} onChange={(e) => setForm({ ...form, isAddOn: e.target.checked })} />
              This is an optional add-on rule (applied per-deal by an admin, not tied to a tier)
            </label>

            {!form.isAddOn && (
              <Select label="Applies to Tier" value={form.tierId} onChange={(e) => setForm({ ...form, tierId: e.target.value })}>
                <option value="">Generic (no tier — fallback rule)</option>
                {tiers.map((t) => <option key={t._id} value={t._id}>{t.partnerType ? `${t.partnerType} — ` : ""}{t.name}</option>)}
              </Select>
            )}

            <Select label="Commission Type" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
              {COMMISSION_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </Select>

            {/* Only the field(s) this commissionType actually reads (see
                computeGrossCommission in commissionEngine.js) are editable —
                showing all three regardless of type let you fill in a field
                the backend would just ignore. */}
            {RATE_TYPES.includes(form.commissionType) && (
              <Input label="Rate (%)" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            )}
            {FIXED_TYPES.includes(form.commissionType) && (
              <Input label="Fixed Amount (₹)" type="number" value={form.fixedAmount} onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })} />
            )}
            {PER_SCREEN_TYPES.includes(form.commissionType) && (
              <Input label="Per Screen Amount (₹)" type="number" value={form.perScreenAmount} onChange={(e) => setForm({ ...form, perScreenAmount: e.target.value })} />
            )}
            {form.commissionType === "hybrid" && (
              <>
                <Input label="Percentage Rate (%)" type="number" value={form.hybridPercentageRate} onChange={(e) => setForm({ ...form, hybridPercentageRate: e.target.value })} />
                <Input label="Fixed Amount (₹)" type="number" value={form.hybridFixedAmount} onChange={(e) => setForm({ ...form, hybridFixedAmount: e.target.value })} />
                <Input label="Per Screen Amount (₹)" type="number" value={form.hybridPerScreenAmount} onChange={(e) => setForm({ ...form, hybridPerScreenAmount: e.target.value })} />
              </>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={form.recurringEnabled} onChange={(e) => setForm({ ...form, recurringEnabled: e.target.checked })} />
              Recurring
            </label>

            {form.recurringEnabled && (
              <>
                <Select label="Duration Type" value={form.durationType} onChange={(e) => setForm({ ...form, durationType: e.target.value })}>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                  <option value="lifetime">Lifetime (while active)</option>
                </Select>
                {form.durationType !== "lifetime" && (
                  <Input label="Duration" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                )}
              </>
            )}

            <div className="md:col-span-2 flex justify-end gap-2">
              {editingId && <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>}
              <Button type="submit" loading={saving}>{editingId ? "Save Changes" : "Create"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table
          empty="No commission rules yet."
          rows={rules}
          columns={[
            { key: "name", header: "Name" },
            { key: "partnerType", header: "Partner Type", render: (r) => r.partnerType ? <Badge tone="neutral">{r.partnerType}</Badge> : "Any" },
            { key: "addon", header: "Add-On?", render: (r) => (r.isAddOn ? <Badge tone="info">Add-on</Badge> : "—") },
            { key: "type", header: "Type", render: (r) => <Badge tone="neutral">{r.commissionType.replace(/_/g, " ")}</Badge> },
            {
              key: "rate",
              header: "Rate",
              render: (r) => {
                if (RATE_TYPES.includes(r.commissionType)) return `${r.rate || 0}%`;
                if (FIXED_TYPES.includes(r.commissionType)) return `₹${r.fixedAmount || 0}`;
                if (PER_SCREEN_TYPES.includes(r.commissionType)) return `₹${r.perScreenAmount || 0}/screen`;
                if (r.commissionType === "hybrid") return `${r.hybrid?.percentageRate || 0}% + ₹${r.hybrid?.fixedAmount || 0} + ₹${r.hybrid?.perScreenAmount || 0}/screen`;
                return "—";
              }
            },
            { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
            { key: "actions", header: "", render: (r) => <button type="button" onClick={() => startEdit(r)} className="text-sm font-semibold text-brand-red hover:underline">Edit</button> }
          ]}
        />
      </Card>
    </div>
  );
}

function ScreenPricingTab() {
  const [basicPrice, setBasicPrice] = useState("");
  const [premiumPrice, setPremiumPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    adminApi.get("/admin/config/screen-pricing")
      .then((res) => {
        setBasicPrice(String(res.data.data.basicPricePerScreen));
        setPremiumPrice(String(res.data.data.premiumPricePerScreen));
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSavedMessage("");
    setSaving(true);
    try {
      await adminApi.put("/admin/config/screen-pricing", {
        basicPricePerScreen: Number(basicPrice),
        premiumPricePerScreen: Number(premiumPrice)
      });
      setSavedMessage("Saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>;

  return (
    <Card className="p-6 max-w-md">
      <p className="text-sm text-slate-500 mb-4">
        Global monthly price per screen for each plan, used to calculate the total on a customer's Subscription page.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Basic — price per screen / month (₹)" type="number" min={0} value={basicPrice} onChange={(e) => setBasicPrice(e.target.value)} required />
        <Input label="Premium — price per screen / month (₹)" type="number" min={0} value={premiumPrice} onChange={(e) => setPremiumPrice(e.target.value)} required />
        <Button type="submit" loading={saving}>Save</Button>
      </form>
      {savedMessage && <p className="text-xs text-emerald-600 mt-3">{savedMessage}</p>}
    </Card>
  );
}

export default function AdminConfig() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Programs, Tiers & Commission Rules</h1>

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t ? "border-brand-red text-brand-red" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Programs" && <ProgramsTab />}
      {tab === "Tiers" && <TiersTab />}
      {tab === "Commission Rules" && <CommissionRulesTab />}
      {tab === "Screen Pricing" && <ScreenPricingTab />}
    </div>
  );
}
