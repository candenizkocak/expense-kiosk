"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Receipt,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
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

export default function ManagePage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>({
    status: "pending",
    category: "all",
    search: "",
    dateFrom: "",
    dateTo: "",
  });

  // Resolve manager
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: manager } = await supabase
        .from("managers")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();
      if (manager) setManagerId(manager.id);
    }
    init();
  }, [supabase]);

  const fetchExpenses = useCallback(async () => {
    if (!managerId) return;
    setLoading(true);

    const { data } = await supabase
      .from("expenses")
      .select(`
        *, employee:employees!employee_id (id, name, email)
      `)
      .order("submitted_at", { ascending: false });

    setExpenses((data as any) || []);
    setLoading(false);
  }, [supabase, managerId]);

  useEffect(() => {
    if (managerId) fetchExpenses();
  }, [managerId, fetchExpenses]);

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
      if (filters.employeeId && e.employee_id !== filters.employeeId)
        return false;
      return true;
    });
  }, [expenses, filters]);

  // Stats
  const stats = useMemo(() => {
    const pending = expenses.filter((e) => e.status === "pending");
    const now = new Date();
    const monthApproved = expenses.filter(
      (e) =>
        e.status === "approved" &&
        e.reviewed_at &&
        new Date(e.reviewed_at) >= startOfMonth(now) &&
        new Date(e.reviewed_at) <= endOfMonth(now)
    );

    // Employee breakdown
    const empMap: Record<string, { name: string; total: number; count: number }> = {};
    expenses.forEach((e) => {
      const name = e.employee?.name || "Unknown";
      if (!empMap[e.employee_id]) empMap[e.employee_id] = { name, total: 0, count: 0 };
      empMap[e.employee_id].total += e.total_price || 0;
      empMap[e.employee_id].count += 1;
    });

    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, e) => s + (e.total_price || 0), 0),
      monthApprovedCount: monthApproved.length,
      monthApprovedAmount: monthApproved.reduce((s, e) => s + (e.total_price || 0), 0),
      total: expenses.length,
      totalAmount: expenses.reduce((s, e) => s + (e.total_price || 0), 0),
      employees: Object.entries(empMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total),
    };
  }, [expenses]);

  // Actions
  async function handleApprove(expenseId: string) {
    if (!managerId) return;
    setActionLoading(expenseId);
    await supabase
      .from("expenses")
      .update({ status: "approved", reviewed_by: managerId })
      .eq("id", expenseId);
    setActionLoading(null);
    setExpandedId(null);
    fetchExpenses();
  }

  async function handleReject(expenseId: string) {
    if (!managerId || !rejectReason.trim()) return;
    setActionLoading(expenseId);
    await supabase
      .from("expenses")
      .update({
        status: "rejected",
        reviewed_by: managerId,
        rejection_reason: rejectReason.trim(),
      })
      .eq("id", expenseId);
    setRejectReason("");
    setActionLoading(null);
    setExpandedId(null);
    fetchExpenses();
  }

  // Batch actions
  async function handleBatchApprove() {
    if (!managerId || selectedIds.size === 0) return;
    setBatchLoading(true);
    for (const id of selectedIds) {
      await supabase
        .from("expenses")
        .update({ status: "approved", reviewed_by: managerId })
        .eq("id", id);
    }
    setSelectedIds(new Set());
    setBatchLoading(false);
    fetchExpenses();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pendingFiltered = filtered.filter((e) => e.status === "pending");
    if (selectedIds.size === pendingFiltered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiltered.map((e) => e.id)));
    }
  }

  const pendingFiltered = filtered.filter((e) => e.status === "pending");

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Approve expenses</h1>
          <p className="text-kiosk-muted mt-1">Review receipts from your team</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Pending</p>
            <Clock className="w-4 h-4 text-kiosk-warning" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-warning mt-2">
            {stats.pendingCount}
          </p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">
            {stats.pendingAmount.toFixed(2)} TRY
          </p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Approved this month</p>
            <CheckCircle2 className="w-4 h-4 text-kiosk-accent" />
          </div>
          <p className="text-2xl font-display font-bold text-kiosk-accent mt-2">
            {stats.monthApprovedCount}
          </p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">
            {stats.monthApprovedAmount.toFixed(2)} TRY
          </p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider">Total expenses</p>
            <TrendingUp className="w-4 h-4 text-kiosk-muted" />
          </div>
          <p className="text-2xl font-display font-bold mt-2">{stats.total}</p>
          <p className="text-xs text-kiosk-muted font-mono mt-0.5">
            {stats.totalAmount.toFixed(2)} TRY
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-kiosk-muted font-medium uppercase tracking-wider mb-3">
            By employee
          </p>
          <div className="space-y-1.5">
            {stats.employees.slice(0, 3).map((emp) => (
              <button
                key={emp.id}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    employeeId: f.employeeId === emp.id ? undefined : emp.id,
                  }))
                }
                className={`flex items-center justify-between w-full text-xs px-2 py-1 rounded-lg transition-colors ${
                  filters.employeeId === emp.id
                    ? "bg-kiosk-accent/10 text-kiosk-accent"
                    : "hover:bg-kiosk-bg text-kiosk-muted"
                }`}
              >
                <span className="truncate">{emp.name}</span>
                <span className="font-mono">{emp.total.toFixed(0)} TRY</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <ExpenseFilterBar filters={filters} onChange={setFilters} />
      </div>

      {/* Batch actions */}
      {pendingFiltered.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-kiosk-muted hover:text-kiosk-text transition-colors"
          >
            {selectedIds.size === pendingFiltered.length ? (
              <CheckSquare className="w-4 h-4 text-kiosk-accent" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Select all pending ({pendingFiltered.length})
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchApprove}
              className="btn-primary text-sm px-4 py-2"
              disabled={batchLoading}
            >
              {batchLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Approve {selectedIds.size} selected
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Expenses list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle2 className="w-10 h-10 text-kiosk-accent mx-auto mb-3" />
          <p className="text-kiosk-muted">No expenses match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((expense) => {
            const isExpanded = expandedId === expense.id;
            const isProcessing = actionLoading === expense.id;
            const isSelected = selectedIds.has(expense.id);

            return (
              <div key={expense.id} className="card transition-all duration-200">
                <div className="flex items-center gap-3">
                  {/* Checkbox for pending */}
                  {expense.status === "pending" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(expense.id); }}
                      className="flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-kiosk-accent" />
                      ) : (
                        <Square className="w-5 h-5 text-kiosk-muted" />
                      )}
                    </button>
                  )}

                  {/* Main row — clickable to expand */}
                  <div
                    className="flex items-center justify-between flex-1 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                  >
                    <div className="flex items-center gap-3">
                      <ReceiptImage
                        path={expense.receipt_image_path}
                        className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">
                            {expense.merchant || "Unknown merchant"}
                          </p>
                          {expense.category && (
                            <span className="text-xs">
                              {CATEGORY_ICONS[expense.category as ExpenseCategory]}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-kiosk-muted">
                          {expense.employee?.name} · {expense.submitted_at
                            ? format(parseISO(expense.submitted_at), "MMM d, yyyy")
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="font-mono font-semibold">
                        {expense.total_price?.toFixed(2)}{" "}
                        <span className="text-kiosk-muted text-xs">{expense.currency}</span>
                      </p>
                      <span className={expense.status === "approved" ? "badge-approved" : expense.status === "rejected" ? "badge-rejected" : "badge-pending"}>
                        {expense.status}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-kiosk-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-kiosk-muted" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-kiosk-border animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div
                        className="cursor-pointer"
                        onClick={() => setSelectedExpense(expense)}
                      >
                        <ReceiptImage
                          path={expense.receipt_image_path}
                          className="w-full rounded-xl border border-kiosk-border hover:border-kiosk-accent/50 transition-colors"
                        />
                        <p className="text-xs text-kiosk-muted mt-2 text-center">
                          Click to zoom
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-kiosk-bg rounded-xl p-3">
                            <p className="text-xs text-kiosk-muted">Net price</p>
                            <p className="font-mono font-semibold mt-0.5">
                              {expense.net_price?.toFixed(2) ?? "—"}
                            </p>
                          </div>
                          <div className="bg-kiosk-bg rounded-xl p-3">
                            <p className="text-xs text-kiosk-muted">Tax rate</p>
                            <p className="font-mono font-semibold mt-0.5">
                              {expense.tax_rate != null ? `${(expense.tax_rate * 100).toFixed(0)}%` : "—"}
                            </p>
                          </div>
                          <div className="bg-kiosk-bg rounded-xl p-3">
                            <p className="text-xs text-kiosk-muted">Tax amount</p>
                            <p className="font-mono font-semibold mt-0.5">
                              {expense.tax_amount?.toFixed(2) ?? "—"}
                            </p>
                          </div>
                          <div className="bg-kiosk-bg rounded-xl p-3">
                            <p className="text-xs text-kiosk-muted">Total</p>
                            <p className="font-mono font-semibold text-kiosk-accent mt-0.5">
                              {expense.total_price?.toFixed(2) ?? "—"}
                            </p>
                          </div>
                        </div>

                        {expense.status === "pending" && (
                          <div className="space-y-3 pt-2">
                            <button
                              onClick={() => handleApprove(expense.id)}
                              className="btn-primary w-full"
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <><CheckCircle2 className="w-4 h-4" /> Approve</>
                              )}
                            </button>
                            <div className="space-y-2">
                              <input
                                type="text"
                                className="input-field text-sm"
                                placeholder="Reason for rejection (required)"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={() => handleReject(expense.id)}
                                className="btn-danger w-full"
                                disabled={isProcessing || !rejectReason.trim()}
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <><XCircle className="w-4 h-4" /> Reject</>
                                )}
                              </button>
                            </div>
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

      {/* Receipt zoom modal */}
      {selectedExpense && (
        <ExpenseModal
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
        />
      )}
    </div>
  );
}
