import { useState } from "react";
import { Funnel, ChevronDown } from "lucide-react";
import { DateRangePicker } from "../ui/daterange-picker";
import type { DateRange } from "react-day-picker";

export type FilterOption = {
  value: string;
  label: string;
};

export type FiltersState = {
  distributor: string;
  rmm: string;
  quarter: string;
  dateRange: DateRange | undefined;
};

interface FiltersPanelProps {
  distributors?: FilterOption[];
  rmmOptions?: FilterOption[];
  quarterOptions?: FilterOption[];
  onApplyFilters?: (filters: FiltersState) => void;
}

export default function FiltersPanel({
  distributors = [],
  rmmOptions = [],
  quarterOptions = [],
  onApplyFilters,
}: FiltersPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>({
    distributor: "",
    rmm: "",
    quarter: "",
    dateRange: undefined,
  });

  const handleChange = <K extends keyof FiltersState>(
    key: K,
    value: FiltersState[K]
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleApply = () => {
    if (onApplyFilters) onApplyFilters(filters);
  };

  return (
    <div className="w-full">
      <div className="collapse bg-base-100/50 rounded-xl border border-base-300 shadow-sm">
        {/* HEADER */}
        <input
          type="checkbox"
          checked={isOpen}
          onChange={() => setIsOpen(!isOpen)}
        />
        <div className="collapse-title flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Funnel size={18} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-base-content">Filters</h3>
          </div>

          <ChevronDown
            size={20}
            className={`transition-transform ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </div>

        {/* BODY */}
        <div className="collapse-content mt-2">
          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Distributor */}
            <div className="form-control">
              <label className="label text-sm font-medium">Distributor</label>
              <select
                className="select select-bordered select-sm w-full"
                value={filters.distributor}
                onChange={(e) => handleChange("distributor", e.target.value)}
              >
                <option value="">Select Distributor</option>
                {distributors.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* RMM */}
            <div className="form-control">
              <label className="label text-sm font-medium">RMM</label>
              <select
                className="select select-bordered select-sm w-full"
                value={filters.rmm}
                onChange={(e) => handleChange("rmm", e.target.value)}
              >
                <option value="">Select RMM</option>
                {rmmOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter */}
            <div className="form-control">
              <label className="label text-sm font-medium">Quarter</label>
              <select
                className="select select-bordered select-sm w-full"
                value={filters.quarter}
                onChange={(e) => handleChange("quarter", e.target.value)}
              >
                <option value="">Select Quarter</option>
                {quarterOptions.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="form-control">
              <DateRangePicker
                value={filters.dateRange}
                onChange={(range) => handleChange("dateRange", range)}
              />
            </div>
          </div>

          {/* APPLY BUTTON */}
          <div className="flex justify-end pt-2 pb-1">
            <button className="btn btn-primary btn-sm" onClick={handleApply}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
