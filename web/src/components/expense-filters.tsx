"use client";

import { Search, X } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/types";
import type { ExpenseFilters, ExpenseStatus, ExpenseCategory } from "@/lib/types";

export function ExpenseFilterBar({
  filters,
  onChange,
  showStatusFilter = true,
}: {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
  showStatusFilter?: boolean;
}) {
  const hasActiveFilters =
    (filters.search && filters.search.length > 0) ||
    (filters.status && filters.status !== "all") ||
    (filters.category && filters.category !== "all") ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kiosk-muted" />
          <input
            type="text"
            placeholder="Search by merchant..."
            className="input-field pl-10 py-2.5 text-sm"
            value={filters.search || ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>

        {/* Status */}
        {showStatusFilter && (
          <select
            className="input-field py-2.5 text-sm w-auto min-w-[140px]"
            value={filters.status || "all"}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.value as ExpenseStatus | "all",
              })
            }
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}

        {/* Category */}
        <select
          className="input-field py-2.5 text-sm w-auto min-w-[180px]"
          value={filters.category || "all"}
          onChange={(e) =>
            onChange({
              ...filters,
              category: e.target.value as ExpenseCategory | "all",
            })
          }
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Date from */}
        <input
          type="date"
          className="input-field py-2.5 text-sm w-auto"
          value={filters.dateFrom || ""}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          placeholder="From"
        />

        {/* Date to */}
        <input
          type="date"
          className="input-field py-2.5 text-sm w-auto"
          value={filters.dateTo || ""}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          placeholder="To"
        />

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() =>
              onChange({
                status: "all",
                category: "all",
                search: "",
                dateFrom: "",
                dateTo: "",
              })
            }
            className="px-3 py-2.5 rounded-xl text-sm text-kiosk-muted hover:text-kiosk-danger transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
