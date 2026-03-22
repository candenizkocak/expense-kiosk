"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Building2, UserCircle, Shield } from "lucide-react";

interface Person {
  id: string;
  name: string;
  email: string;
  created_at: string;
  type: "admin" | "manager" | "employee";
  manager_name?: string;
}

export default function AdminPeoplePage() {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "admin" | "manager" | "employee">("all");

  useEffect(() => {
    async function fetch() {
      const all: Person[] = [];

      const { data: admins } = await supabase.from("admins").select("id, name, email, created_at");
      (admins || []).forEach((a) => all.push({ ...a, type: "admin" }));

      const { data: managers } = await supabase.from("managers").select("id, name, email, created_at");
      (managers || []).forEach((m) => all.push({ ...m, type: "manager" }));

      const { data: employees } = await supabase
        .from("employees")
        .select("id, name, email, created_at, manager:managers!manager_id (name)");
      (employees || []).forEach((e: any) =>
        all.push({
          id: e.id,
          name: e.name,
          email: e.email,
          created_at: e.created_at,
          type: "employee",
          manager_name: e.manager?.name,
        })
      );

      all.sort((a, b) => {
        const order = { admin: 0, manager: 1, employee: 2 };
        return order[a.type] - order[b.type];
      });

      setPeople(all);
      setLoading(false);
    }
    fetch();
  }, [supabase]);

  const filtered = filter === "all" ? people : people.filter((p) => p.type === filter);

  const typeIcon = {
    admin: <Shield className="w-4 h-4 text-kiosk-danger" />,
    manager: <Building2 className="w-4 h-4 text-kiosk-accent" />,
    employee: <UserCircle className="w-4 h-4 text-kiosk-muted" />,
  };

  const typeBadge = {
    admin: "bg-kiosk-danger/10 text-kiosk-danger border-kiosk-danger/20",
    manager: "bg-kiosk-accent/10 text-kiosk-accent border-kiosk-accent/20",
    employee: "bg-kiosk-bg text-kiosk-muted border-kiosk-border",
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">People</h1>
          <p className="text-kiosk-muted mt-1">{people.length} people in the system</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "admin", "manager", "employee"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f
                ? "bg-kiosk-accent text-kiosk-bg"
                : "bg-kiosk-surface text-kiosk-muted border border-kiosk-border hover:text-kiosk-text"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
            <span className="ml-1.5 opacity-60">
              {f === "all" ? people.length : people.filter((p) => p.type === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* People list */}
      <div className="space-y-2">
        {filtered.map((person) => (
          <div key={`${person.type}-${person.id}`} className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-kiosk-bg border border-kiosk-border flex items-center justify-center">
                {typeIcon[person.type]}
              </div>
              <div>
                <p className="font-semibold">{person.name}</p>
                <p className="text-xs text-kiosk-muted">{person.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {person.manager_name && (
                <span className="text-xs text-kiosk-muted">
                  Reports to {person.manager_name}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${typeBadge[person.type]}`}>
                {typeIcon[person.type]}
                {person.type.charAt(0).toUpperCase() + person.type.slice(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
