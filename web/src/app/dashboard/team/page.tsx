"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, TrendingUp, Receipt } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/types";
import type { ExpenseCategory } from "@/lib/types";

interface EmployeeStats {
  id: string;
  name: string;
  email: string;
  totalExpenses: number;
  totalAmount: number;
  pending: number;
  approved: number;
  rejected: number;
  topCategory: string;
}

export default function TeamPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<EmployeeStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from("managers")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (!manager) return;

      // Get all employees under this manager
      const { data: emps } = await supabase
        .from("employees")
        .select("id, name, email")
        .eq("manager_id", manager.id);

      if (!emps) { setLoading(false); return; }

      // Get all expenses for these employees
      const empIds = emps.map((e) => e.id);
      const { data: expenses } = await supabase
        .from("expenses")
        .select("*")
        .in("employee_id", empIds);

      const statsMap: Record<string, EmployeeStats> = {};
      emps.forEach((e) => {
        statsMap[e.id] = {
          id: e.id,
          name: e.name,
          email: e.email,
          totalExpenses: 0,
          totalAmount: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          topCategory: "other",
        };
      });

      const catMap: Record<string, Record<string, number>> = {};
      (expenses || []).forEach((exp) => {
        const s = statsMap[exp.employee_id];
        if (!s) return;
        s.totalExpenses += 1;
        s.totalAmount += exp.total_price || 0;
        if (exp.status === "pending") s.pending += 1;
        if (exp.status === "approved") s.approved += 1;
        if (exp.status === "rejected") s.rejected += 1;

        if (!catMap[exp.employee_id]) catMap[exp.employee_id] = {};
        const cat = exp.category || "other";
        catMap[exp.employee_id][cat] = (catMap[exp.employee_id][cat] || 0) + (exp.total_price || 0);
      });

      Object.keys(catMap).forEach((empId) => {
        const cats = catMap[empId];
        const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
        if (top && statsMap[empId]) statsMap[empId].topCategory = top[0];
      });

      setEmployees(Object.values(statsMap).sort((a, b) => b.totalAmount - a.totalAmount));
      setLoading(false);
    }
    fetch();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Team overview</h1>
        <p className="text-kiosk-muted mt-1">Spending breakdown by employee</p>
      </div>

      {employees.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-10 h-10 text-kiosk-muted mx-auto mb-3" />
          <p className="text-kiosk-muted">No employees found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => (
            <div key={emp.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-kiosk-bg border border-kiosk-border flex items-center justify-center font-display font-bold text-sm text-kiosk-muted">
                    {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold">{emp.name}</p>
                    <p className="text-xs text-kiosk-muted">{emp.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-lg">
                    {emp.totalAmount.toFixed(2)} <span className="text-xs text-kiosk-muted">TRY</span>
                  </p>
                  <p className="text-xs text-kiosk-muted">{emp.totalExpenses} expenses</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-3">
                <div className="bg-kiosk-bg rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-kiosk-muted">Pending</p>
                  <p className="font-mono font-semibold text-kiosk-warning">{emp.pending}</p>
                </div>
                <div className="bg-kiosk-bg rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-kiosk-muted">Approved</p>
                  <p className="font-mono font-semibold text-kiosk-accent">{emp.approved}</p>
                </div>
                <div className="bg-kiosk-bg rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-kiosk-muted">Rejected</p>
                  <p className="font-mono font-semibold text-kiosk-danger">{emp.rejected}</p>
                </div>
                <div className="bg-kiosk-bg rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-kiosk-muted">Top category</p>
                  <p className="text-sm mt-0.5">
                    {CATEGORY_ICONS[emp.topCategory as ExpenseCategory]}{" "}
                    <span className="text-xs">{CATEGORY_LABELS[emp.topCategory as ExpenseCategory]}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
