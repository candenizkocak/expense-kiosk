"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  Clock,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/types";
import type { Expense, ExpenseFilters, ExpenseCategory } from "@/lib/types";
import { ReceiptImage } from "@/components/receipt-image";
import { ExpenseFilterBar } from "@/components/expense-filters";
import { ExpenseModal } from "@/components/expense-modal";

export default function EmployeeDashboard() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({
    status: "all",
    category: "all",
    search: "",
    dateFrom: "",
    dateTo: "",
  });

  // Resolve employee on mount
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (employee) {
        setEmployeeId(employee.id);
      }
    }
    init();
  }, [supabase]);

  // Fetch expenses when employee is resolved
  useEffect(() => {
    if (!employeeId) return;

    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("employee_id", employeeId)
        .order("submitted_at", { ascending: false });

      setExpenses(data || []);
      setLoading(false);
    }
    fetch();
  }, [supabase, employeeId]);

  // Filtered expenses
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (filters.status && filters.status !== "all" && e.status !== filters.status)
        return false;
      if (filters.category && filters.category !== "all" && e.category !== filters.category)
        return false;
      if (filters.search && !e.merchant?.toLowerCase().includes(filters.search.toLowerCase()))
        return false;
      if (filters.dateFrom && e.expense_date && e.expense_date < filters.dateFrom)
        return false;
      if (filters.dateTo && e.expense_date && e.expense_date > filters.dateTo)
        return false;
      return true;
    });
  }, [expenses, filters]);

  // Stats
  const stats = useMemo(() => {
    const pending = expenses.filter((e) => e.status === "pending");
    const approved = expenses.filter((e) => e.status === "approved");
    const rejected = expenses.filter((e) => e.status === "rejected");

    const thisMonth = expenses.filter((e) => {
      const d = e.submitted_at ? new Date(e.submitted_at) : null;
      if (!d) return false;
      const now = new Date();
      return d >= startOfMonth(now) && d <= endOfMonth(now);
    });

    return {
      pending: pending.length,
      pendingAmount: pending.reduce((s, e) => s + (e.total_price || 0), 0),
      approved: approved.length,
      approvedAmount: approved.reduce((s, e) => s + (e.total_price || 0), 0),
      rejected: rejected.length,
      thisMonthCount: thisMonth.length,
      thisMonthAmount: thisMonth.reduce((s, e) => s + (e.total_price || 0), 0),
    };
  }, [expenses]);

  // Monthly chart data (last 6 months)
  const monthlyData = useMemo(() => {
    const months: { label: string; total: number; count: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthExpenses = expenses.filter((e) => {
        const d = e.submitted_at ? new Date(e.submitted_at) : null;
        return d && d >= start && d <= end;
      });
      months.push({
        label: format(date, "MMM"),
        total: monthExpenses.reduce((s, e) => s + (e.total_price || 0), 0),
        count: monthExpenses.length,
      });
    }
    return months;
  }, [expenses]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "other";
      map[cat] = (map[cat] || 0) + (e.total_price || 0);
    });
    return Object.entries(map)
      .map(([cat, amount]) => ({
        category: cat as ExpenseCategory,
        amount,
        label: CATEGORY_LABELS[cat as ExpenseCategory] || cat,
        icon: CATEGORY_ICONS[cat as ExpenseCategory] || "📦",
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1);

  const statusIcon = {
    pending: <Clock className="w-3.5 h-3.5" />,
    approved: <CheckCircle2 className="w-3.5 h-3.5" />,
    rejected: <XCircle className="w-3.5 h-3.5" />,
  };

  const statusBadge = {
    pending: "badge-pending",
    approved: "badge-approved",
    rejected: "badge-rejected",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">My expenses</h1>
        <p className="text-kiosk-muted mt-1">
          Track your submitted receipts and payment status
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Pending</p>
            <Clock className="w-4 h-4 text-kiosk-warning" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-warning mt-2">{stats.pending}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">
            {stats.pendingAmount.toFixed(2)} TRY
          </p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Approved</p>
            <CheckCircle2 className="w-4 h-4 text-kiosk-accent" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-accent mt-2">{stats.approved}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">
            {stats.approvedAmount.toFixed(2)} TRY
          </p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Rejected</p>
            <XCircle className="w-4 h-4 text-kiosk-danger" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-danger mt-2">{stats.rejected}</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">This month</p>
            <TrendingUp className="w-4 h-4 text-kiosk-muted" />
          </div>
          <p className="text-2xl font-display font-bold mt-2">{stats.thisMonthCount}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">
            {stats.thisMonthAmount.toFixed(2)} TRY
          </p>
        </div>
      </div>

      {/* Charts row */}
      {expenses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Monthly bar chart */}
          <div className="card">
            <h3 className="text-sm font-medium text-kiosk-muted mb-4">
              Monthly spending (last 6 months)
            </h3>
            <div className="flex items-end gap-2 h-32">
              {monthlyData.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono text-kiosk-muted">
                    {m.total > 0 ? `${(m.total / 1000).toFixed(1)}k` : ""}
                  </span>
                  <div
                    className="w-full bg-kiosk-accent/20 rounded-t-lg transition-all duration-500 min-h-[4px]"
                    style={{ height: `${Math.max((m.total / maxMonthly) * 100, 4)}%` }}
                  >
                    <div
                      className="w-full bg-kiosk-accent rounded-t-lg transition-all duration-500"
                      style={{ height: "100%" }}
                    />
                  </div>
                  <span className="text-xs text-kiosk-muted">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="card">
            <h3 className="text-sm font-medium text-kiosk-muted mb-4">
              Spending by category
            </h3>
            <div className="space-y-2.5">
              {categoryData.slice(0, 5).map((c) => {
                const maxCat = categoryData[0]?.amount || 1;
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-sm w-6 text-center">{c.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-kiosk-muted">{c.label}</span>
                        <span className="font-mono">{c.amount.toFixed(0)} TRY</span>
                      </div>
                      <div className="h-1.5 bg-kiosk-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-kiosk-accent rounded-full transition-all duration-500"
                          style={{ width: `${(c.amount / maxCat) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {categoryData.length === 0 && (
                <p className="text-sm text-kiosk-muted text-center py-4">No data yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4">
        <ExpenseFilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Expenses list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Receipt className="w-10 h-10 text-kiosk-muted mx-auto mb-3" />
          <p className="text-kiosk-muted">
            {expenses.length === 0
              ? "No expenses submitted yet"
              : "No expenses match your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((expense) => (
            <div
              key={expense.id}
              onClick={() => setSelectedExpense(expense)}
              className="card flex items-center justify-between hover:border-kiosk-muted/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <ReceiptImage
                  path={expense.receipt_image_path}
                  className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold group-hover:text-kiosk-accent transition-colors">
                      {expense.merchant || "Unknown merchant"}
                    </p>
                    {expense.category && (
                      <span className="text-xs text-kiosk-muted">
                        {CATEGORY_ICONS[expense.category as ExpenseCategory]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-kiosk-muted">
                    {expense.submitted_at
                      ? format(parseISO(expense.submitted_at), "MMM d, yyyy")
                      : ""}
                    {expense.category && (
                      <span className="ml-2 text-xs">
                        {CATEGORY_LABELS[expense.category as ExpenseCategory]}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-mono font-semibold">
                    {expense.total_price?.toFixed(2)}{" "}
                    <span className="text-kiosk-muted text-xs">{expense.currency}</span>
                  </p>
                  {expense.net_price && (
                    <p className="text-xs text-kiosk-muted font-mono">
                      net {expense.net_price.toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="w-28 text-right">
                  <span className={statusBadge[expense.status]}>
                    {statusIcon[expense.status]}
                    <span className="ml-1 capitalize">{expense.status}</span>
                  </span>
                  {expense.status === "approved" && expense.payment_date && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-kiosk-accent justify-end">
                      <CalendarCheck className="w-3 h-3" />
                      Pay: {format(parseISO(expense.payment_date), "MMM d")}
                    </div>
                  )}
                  {expense.status === "rejected" && expense.rejection_reason && (
                    <p className="text-xs text-kiosk-danger mt-1.5 max-w-32 truncate">
                      {expense.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expense detail modal */}
      {selectedExpense && (
        <ExpenseModal
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
        />
      )}
    </div>
  );
}
