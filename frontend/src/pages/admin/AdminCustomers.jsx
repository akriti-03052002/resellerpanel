import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import { Select, Input } from "../../components/ui/Input";

const STATUSES = ["", "pending", "allocated", "pending_activation", "active", "suspended", "cancelled"];

// Read-only cross-partner view — admin has no management role over a
// reseller's own end customers, this exists purely for oversight.
export default function AdminCustomers() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");

  const { data: customers = [], isLoading: loading } = useQuery({
    queryKey: ["admin", "customers", { status, search: committedSearch }],
    queryFn: () =>
      adminApi
        .get("/admin/reseller/customers", { params: { status: status || undefined, search: committedSearch || undefined } })
        .then((res) => res.data.data)
  });

  const runSearch = () => setCommittedSearch(search);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by company, contact or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          className="flex-1"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-56">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
        </Select>
      </Card>

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No customers found."
            rows={customers}
            columns={[
              { key: "company", header: "Company", render: (c) => c.businessDetails?.companyName || "—" },
              { key: "contact", header: "Contact", render: (c) => c.contactDetails?.name || "—" },
              { key: "email", header: "Email", render: (c) => c.contactDetails?.email || "—" },
              {
                key: "reseller",
                header: "Reseller",
                render: (c) => c.partnerId?.legalEntity?.businessName || c.partnerId?.partnerCode || "—"
              },
              { key: "status", header: "Status", render: (c) => <Badge status={c.status} /> },
              {
                key: "screens",
                header: "Screens",
                render: (c) =>
                  c.allocation
                    ? `${c.allocation.registeredScreens} of ${c.allocation.allocatedLicenses} registered`
                    : <span className="text-slate-400">No allocation</span>
              },
              { key: "active", header: "Active", render: (c) => c.allocation?.activeScreens ?? 0 }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
