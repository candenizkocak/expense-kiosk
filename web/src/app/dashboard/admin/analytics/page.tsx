"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { TrendingUp, DollarSign, Users, Clock } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/types";
import type { Expense, ExpenseCategory } from "@/lib/types";

export default function AdminAnalyticsPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<(Expense & { employee: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("expenses")
        .select("*, employee:employees!employee_id (name)")
        .order("submitted_at", { ascending: false });
      setExpenses((data as any) || []);
      setLoading(false);
    }
    fetch();
  }, [supabase]);

  // Monthly trend (12 months)
  const monthlyTrend = useMemo(() => {
    const months: { label: string; total: number; count: number; approved: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(now, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthExps = expenses.filter((e) => {
        const d = e.submitted_at ? new Date(e.submitted_at) : null;
        return d && d >= start && d <= end;
      });
      months.push({
        label: format(date, "MMM"),
        total: monthExps.reduce((s, e) => s + (e.total_price || 0), 0),
        count: monthExps.length,
        approved: monthExps.filter((e) => e.status === "approved").reduce((s, e) => s + (e.total_price || 0), 0),
      });
    }
    return months;
  }, [expenses]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { amount: number; count: number }> = {};
    expenses.forEach((e) => {
      const cat = e.category || "other";
      if (!map[cat]) map[cat] = { amount: 0, count: 0 };
      map[cat].amount += e.total_price || 0;
      map[cat].count += 1;
    });
    return Object.entries(map)
      .map(([cat, data]) => ({
        category: cat as ExpenseCategory,
        label: CATEGORY_LABELS[cat as ExpenseCategory] || cat,
        icon: CATEGORY_ICONS[cat as ExpenseCategory] || "📦",
        ...data,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // Top spenders
  const topSpenders = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    expenses.forEach((e) => {
      const name = e.employee?.name || "Unknown";
      if (!map[e.employee_id]) map[e.employee_id] = { name, amount: 0, count: 0 };
      map[e.employee_id].amount += e.total_price || 0;
      map[e.employee_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  // Summary stats
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter((e) => {
      const d = e.submitted_at ? new Date(e.submitted_at) : null;
      return d && d >= startOfMonth(now) && d <= endOfMonth(now);
    });
    const avgPerExpense = expenses.length > 0
      ? expenses.reduce((s, e) => s + (e.total_price || 0), 0) / expenses.length
      : 0;

    return {
      totalAmount: expenses.reduce((s, e) => s + (e.total_price || 0), 0),
      totalCount: expenses.length,
      thisMonthAmount: thisMonth.reduce((s, e) => s + (e.total_price || 0), 0),
      avgPerExpense,
      pendingCount: expenses.filter((e) => e.status === "pending").length,
    };
  }, [expenses]);

  const maxMonthly = Math.max(...monthlyTrend.map((m) => m.total), 1);
  const maxCategory = categoryBreakdown[0]?.amount || 1;
  const maxSpender = topSpenders[0]?.amount || 1;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Analytics</h1>
        <p className="text-kiosk-muted mt-1">Company-wide expense insights</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Total spend</p>
            <DollarSign className="w-4 h-4 text-kiosk-accent" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-accent mt-2">{(stats.totalAmount / 1000).toFixed(1)}k</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">{stats.totalCount} expenses</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">This month</p>
            <TrendingUp className="w-4 h-4 text-kiosk-muted" />
          </div>
          <p className="text-2xl font-display font-bold mt-2">{stats.thisMonthAmount.toFixed(0)}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">TRY</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Avg per expense</p>
            <DollarSign className="w-4 h-4 text-kiosk-muted" />
          </div>
          <p className="text-2xl font-display font-bold mt-2">{stats.avgPerExpense.toFixed(0)}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">TRY</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Pending</p>
            <Clock className="w-4 h-4 text-kiosk-warning" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-warning mt-2">{stats.pendingCount}</p>
          <p className="text-xs text-kiosk-muted mt-0.5">awaiting review</p>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="card mb-6">
        <h3 className="text-sm font-medium text-kiosk-muted mb-4">Monthly spending trend (12 months)</h3>
        <div className="flex items-end gap-1.5 h-40">
          {monthlyTrend.map((m) => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-mono text-kiosk-muted">
                {m.total > 0 ? `${(m.total / 1000).toFixed(1)}k` : ""}
              </span>
              <div className="w-full rounded-t-md overflow-hidden" style={{ height: `${Math.max((m.total / maxMonthly) * 100, 3)}%` }}>
                <div className="w-full h-full bg-kiosk-accent/30" style={{ position: "relative" }}>
                  <div className="absolute bottom-0 w-full bg-kiosk-accent" style={{ height: `${m.total > 0 ? (m.approved / m.total) * 100 : 0}%` }} />
                </div>
              </div>
              <span className="text-xs text-kiosk-muted">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-kiosk-muted">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-kiosk-accent" /> Approved</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-kiosk-accent/30" /> Total submitted</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="card">
          <h3 className="text-sm font-medium text-kiosk-muted mb-4">Spending by category</h3>
          <div className="space-y-3">
            {categoryBreakdown.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-base w-7 text-center">{c.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-kiosk-muted">{c.label}</span>
                    <span className="font-mono">{c.amount.toFixed(0)} TRY <span className="text-kiosk-muted">({c.count})</span></span>
                  </div>
                  <div className="h-2 bg-kiosk-bg rounded-full overflow-hidden">
                    <div className="h-full bg-kiosk-accent rounded-full transition-all" style={{ width: `${(c.amount / maxCategory) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top spenders */}
        <div className="card">
          <h3 className="text-sm font-medium text-kiosk-muted mb-4">Top spenders</h3>
          <div className="space-y-3">
            {topSpenders.slice(0, 8).map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-kiosk-bg border border-kiosk-border flex items-center justify-center text-xs font-mono text-kiosk-muted font-bold">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{s.name}</span>
                    <span className="font-mono">{s.amount.toFixed(0)} TRY <span className="text-kiosk-muted">({s.count})</span></span>
                  </div>
                  <div className="h-2 bg-kiosk-bg rounded-full overflow-hidden">
                    <div className="h-full bg-kiosk-warning rounded-full transition-all" style={{ width: `${(s.amount / maxSpender) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
