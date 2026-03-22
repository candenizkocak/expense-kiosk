"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/types";
import type { Expense, ExpenseFilters, ExpenseCategory } from "@/lib/types";
import { ReceiptImage } from "@/components/receipt-image";
import { ExpenseFilterBar } from "@/components/expense-filters";
import { ExpenseModal } from "@/components/expense-modal";

interface ExpenseRow extends Expense {
  employee: { id: string; name: string; email: string };
}

export default function AdminExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({
    status: "all",
    category: "all",
    search: "",
  });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: admin } = await supabase
        .from("admins")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (admin) setAdminId(admin.id);
    }
    init();
  }, [supabase]);

  const fetchExpenses = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    const { data } = await supabase
      .from("expenses")
      .select(`*, employee:employees!employee_id (id, name, email)`)
      .order("submitted_at", { ascending: false });
    setExpenses((data as any) || []);
    setLoading(false);
  }, [supabase, adminId]);

  useEffect(() => {
    if (adminId) fetchExpenses();
  }, [adminId, fetchExpenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (filters.status && filters.status !== "all" && e.status !== filters.status) return false;
      if (filters.category && filters.category !== "all" && e.category !== filters.category) return false;
      if (filters.search && !e.merchant?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.dateFrom && e.expense_date && e.expense_date < filters.dateFrom) return false;
      if (filters.dateTo && e.expense_date && e.expense_date > filters.dateTo) return false;
      return true;
    });
  }, [expenses, filters]);

  const stats = useMemo(() => {
    const now = new Date();
    const pending = expenses.filter((e) => e.status === "pending");
    const thisMonth = expenses.filter((e) => {
      const d = e.submitted_at ? new Date(e.submitted_at) : null;
      return d && d >= startOfMonth(now) && d <= endOfMonth(now);
    });
    return {
      total: expenses.length,
      totalAmount: expenses.reduce((s, e) => s + (e.total_price || 0), 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, e) => s + (e.total_price || 0), 0),
      thisMonthAmount: thisMonth.reduce((s, e) => s + (e.total_price || 0), 0),
    };
  }, [expenses]);

  async function handleApprove(id: string) {
    if (!adminId) return;
    setActionLoading(id);
    await supabase.from("expenses").update({ status: "approved", reviewed_by: adminId }).eq("id", id);
    setActionLoading(null);
    setExpandedId(null);
    fetchExpenses();
  }

  async function handleReject(id: string) {
    if (!adminId || !rejectReason.trim()) return;
    setActionLoading(id);
    await supabase.from("expenses").update({ status: "rejected", reviewed_by: adminId, rejection_reason: rejectReason.trim() }).eq("id", id);
    setRejectReason("");
    setActionLoading(null);
    setExpandedId(null);
    fetchExpenses();
  }

  async function handleBatchApprove() {
    if (!adminId || selectedIds.size === 0) return;
    setBatchLoading(true);
    for (const id of selectedIds) {
      await supabase.from("expenses").update({ status: "approved", reviewed_by: adminId }).eq("id", id);
    }
    setSelectedIds(new Set());
    setBatchLoading(false);
    fetchExpenses();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pendingFiltered = filtered.filter((e) => e.status === "pending");

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-kiosk-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">All expenses</h1>
        <p className="text-kiosk-muted mt-1">System-wide view of every expense</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Total</p>
            <DollarSign className="w-4 h-4 text-kiosk-muted" />
          </div>
          <p className="text-2xl font-display font-bold mt-2">{stats.total}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">{stats.totalAmount.toFixed(2)} TRY</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Pending</p>
            <Clock className="w-4 h-4 text-kiosk-warning" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-warning mt-2">{stats.pendingCount}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">{stats.pendingAmount.toFixed(2)} TRY</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">This month</p>
            <TrendingUp className="w-4 h-4 text-kiosk-accent" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-accent mt-2">{stats.thisMonthAmount.toFixed(0)}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">TRY</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Showing</p>
          </div>
          <p className="text-2xl font-display font-bold mt-2">{filtered.length}</p>
          <p className="text-xs text-kiosk-muted mt-0.5">of {expenses.length} filtered</p>
        </div>
      </div>

      <div className="mb-4">
        <ExpenseFilterBar filters={filters} onChange={setFilters} />
      </div>

      {pendingFiltered.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => {
            if (selectedIds.size === pendingFiltered.length) setSelectedIds(new Set());
            else setSelectedIds(new Set(pendingFiltered.map((e) => e.id)));
          }} className="flex items-center gap-2 text-sm text-kiosk-muted hover:text-kiosk-text transition-colors">
            {selectedIds.size === pendingFiltered.length ? <CheckSquare className="w-4 h-4 text-kiosk-accent" /> : <Square className="w-4 h-4" />}
            Select all pending ({pendingFiltered.length})
          </button>
          {selectedIds.size > 0 && (
            <button onClick={handleBatchApprove} className="btn-primary text-sm px-4 py-2" disabled={batchLoading}>
              {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Approve {selectedIds.size}</>}
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card text-center py-12"><p className="text-kiosk-muted">No expenses match your filters</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((expense) => {
            const isExpanded = expandedId === expense.id;
            const isProcessing = actionLoading === expense.id;
            return (
              <div key={expense.id} className="card transition-all duration-200">
                <div className="flex items-center gap-3">
                  {expense.status === "pending" && (
                    <button onClick={(e) => { e.stopPropagation(); toggleSelect(expense.id); }} className="flex-shrink-0">
                      {selectedIds.has(expense.id) ? <CheckSquare className="w-5 h-5 text-kiosk-accent" /> : <Square className="w-5 h-5 text-kiosk-muted" />}
                    </button>
                  )}
                  <div className="flex items-center justify-between flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : expense.id)}>
                    <div className="flex items-center gap-3">
                      <ReceiptImage path={expense.receipt_image_path} className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 object-cover" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{expense.merchant || "Unknown"}</p>
                          {expense.category && <span className="text-xs">{CATEGORY_ICONS[expense.category as ExpenseCategory]}</span>}
                        </div>
                        <p className="text-xs text-kiosk-muted">{expense.employee?.name} · {expense.submitted_at ? format(parseISO(expense.submitted_at), "MMM d, yyyy") : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-mono font-semibold">{expense.total_price?.toFixed(2)} <span className="text-kiosk-muted text-xs">{expense.currency}</span></p>
                      <span className={expense.status === "approved" ? "badge-approved" : expense.status === "rejected" ? "badge-rejected" : "badge-pending"}>{expense.status}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-kiosk-muted" /> : <ChevronDown className="w-4 h-4 text-kiosk-muted" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-kiosk-border animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="cursor-pointer" onClick={() => setSelectedExpense(expense)}>
                        <ReceiptImage path={expense.receipt_image_path} className="w-full rounded-xl border border-kiosk-border hover:border-kiosk-accent/50 transition-colors" />
                        <p className="text-xs text-kiosk-muted mt-2 text-center">Click to zoom</p>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-kiosk-bg rounded-xl p-3"><p className="text-xs text-kiosk-muted">Net</p><p className="font-mono font-semibold mt-0.5">{expense.net_price?.toFixed(2) ?? "—"}</p></div>
                          <div className="bg-kiosk-bg rounded-xl p-3"><p className="text-xs text-kiosk-muted">Tax</p><p className="font-mono font-semibold mt-0.5">{expense.tax_amount?.toFixed(2) ?? "—"}</p></div>
                          <div className="bg-kiosk-bg rounded-xl p-3"><p className="text-xs text-kiosk-muted">Rate</p><p className="font-mono font-semibold mt-0.5">{expense.tax_rate != null ? `${(expense.tax_rate * 100).toFixed(0)}%` : "—"}</p></div>
                          <div className="bg-kiosk-bg rounded-xl p-3"><p className="text-xs text-kiosk-muted">Total</p><p className="font-mono font-semibold text-kiosk-accent mt-0.5">{expense.total_price?.toFixed(2) ?? "—"}</p></div>
                        </div>
                        {expense.status === "pending" && (
                          <div className="space-y-3 pt-2">
                            <button onClick={() => handleApprove(expense.id)} className="btn-primary w-full" disabled={isProcessing}>
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Approve</>}
                            </button>
                            <input type="text" className="input-field text-sm" placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} onClick={(e) => e.stopPropagation()} />
                            <button onClick={() => handleReject(expense.id)} className="btn-danger w-full" disabled={isProcessing || !rejectReason.trim()}>
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Reject</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedExpense && <ExpenseModal expense={selectedExpense} onClose={() => setSelectedExpense(null)} />}
    </div>
  );
}
