"use client";

import { useState } from "react";
import { X, ZoomIn, ZoomOut, CalendarCheck } from "lucide-react";
import { ReceiptImage } from "@/components/receipt-image";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/types";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { format, parseISO } from "date-fns";

export function ExpenseModal({
  expense,
  onClose,
}: {
  expense: Expense & { employee?: { name: string; email: string } };
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  const statusBadge = {
    pending: "badge-pending",
    approved: "badge-approved",
    rejected: "badge-rejected",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-kiosk-surface border border-kiosk-border rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-kiosk-border">
          <div>
            <h2 className="text-lg font-display font-bold">
              {expense.merchant || "Unknown merchant"}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={statusBadge[expense.status]}>
                {expense.status}
              </span>
              {expense.category && (
                <span className="text-sm text-kiosk-muted">
                  {CATEGORY_ICONS[expense.category as ExpenseCategory]}{" "}
                  {CATEGORY_LABELS[expense.category as ExpenseCategory]}
                </span>
              )}
              {expense.employee && (
                <span className="text-sm text-kiosk-muted">
                  · {expense.employee.name}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-kiosk-bg transition-colors"
          >
            <X className="w-5 h-5 text-kiosk-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receipt image with zoom */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-kiosk-muted">Receipt image</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                    className="p-1.5 rounded-lg hover:bg-kiosk-bg"
                  >
                    <ZoomOut className="w-4 h-4 text-kiosk-muted" />
                  </button>
                  <span className="text-xs text-kiosk-muted w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                    className="p-1.5 rounded-lg hover:bg-kiosk-bg"
                  >
                    <ZoomIn className="w-4 h-4 text-kiosk-muted" />
                  </button>
                </div>
              </div>
              <div className="overflow-auto rounded-xl border border-kiosk-border bg-kiosk-bg max-h-[60vh]">
                <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                  <ReceiptImage
                    path={expense.receipt_image_path}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-kiosk-bg rounded-xl p-4">
                  <p className="text-xs text-kiosk-muted">Net price</p>
                  <p className="font-mono font-semibold text-lg mt-1">
                    {expense.net_price?.toFixed(2) ?? "—"}
                  </p>
                </div>
                <div className="bg-kiosk-bg rounded-xl p-4">
                  <p className="text-xs text-kiosk-muted">Tax rate</p>
                  <p className="font-mono font-semibold text-lg mt-1">
                    {expense.tax_rate != null
                      ? `${(expense.tax_rate * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
                <div className="bg-kiosk-bg rounded-xl p-4">
                  <p className="text-xs text-kiosk-muted">Tax amount</p>
                  <p className="font-mono font-semibold text-lg mt-1">
                    {expense.tax_amount?.toFixed(2) ?? "—"}
                  </p>
                </div>
                <div className="bg-kiosk-bg rounded-xl p-4">
                  <p className="text-xs text-kiosk-muted">Total</p>
                  <p className="font-mono font-semibold text-lg text-kiosk-accent mt-1">
                    {expense.total_price?.toFixed(2) ?? "—"}{" "}
                    <span className="text-sm text-kiosk-muted">{expense.currency}</span>
                  </p>
                </div>
              </div>

              {expense.expense_date && (
                <div className="bg-kiosk-bg rounded-xl p-4">
                  <p className="text-xs text-kiosk-muted">Receipt date</p>
                  <p className="font-mono mt-1">
                    {format(parseISO(expense.expense_date), "MMMM d, yyyy")}
                  </p>
                </div>
              )}

              {expense.submitted_at && (
                <div className="bg-kiosk-bg rounded-xl p-4">
                  <p className="text-xs text-kiosk-muted">Submitted</p>
                  <p className="font-mono mt-1">
                    {format(parseISO(expense.submitted_at), "MMM d, yyyy 'at' HH:mm")}
                  </p>
                </div>
              )}

              {expense.status === "approved" && expense.payment_date && (
                <div className="bg-kiosk-accent/10 border border-kiosk-accent/20 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-kiosk-accent" />
                    <p className="text-xs text-kiosk-accent font-medium">Payment date</p>
                  </div>
                  <p className="font-mono mt-1 text-kiosk-accent">
                    {format(parseISO(expense.payment_date), "MMMM d, yyyy")}
                  </p>
                </div>
              )}

              {expense.status === "rejected" && expense.rejection_reason && (
                <div className="bg-kiosk-danger/10 border border-kiosk-danger/20 rounded-xl p-4">
                  <p className="text-xs text-kiosk-danger font-medium">Rejection reason</p>
                  <p className="mt-1 text-sm">{expense.rejection_reason}</p>
                </div>
              )}

              {expense.notes && (
                <div className="bg-kiosk-bg rounded-xl p-4">
                  <p className="text-xs text-kiosk-muted">Notes</p>
                  <p className="mt-1 text-sm">{expense.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
