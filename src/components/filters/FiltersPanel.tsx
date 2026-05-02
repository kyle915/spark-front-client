import { useCallback, useEffect, useRef, useState } from "react";
import { Funnel, ChevronDown } from "lucide-react";
import { DateRangePicker } from "../ui/daterange-picker";
import type { DateRange } from "react-day-picker";
import { useForm } from "react-hook-form";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";
import { useAuthStore } from "@/store/authStore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import FormAutocomplete from "@shared/FormAutocomplete";

import { DistributorsQuery } from "@/api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@/api/queries/__generated__/DistributorsQuery.graphql";

import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@/api/queries/__generated__/RmmClientsQuery.graphql";
import FormMultiAutocomplete from "@/shared/FormMultiAutocomplete";

export type DashboardFilters = {
  distributorIds: string[] | null;
  rmmAsignedId: string | null;
  quarter: string | null;
  startDate: string | null;
  endDate: string | null;
};

type FiltersFormValues = {
  distributors: string[];
  rmm: string | null;
  quarter: string;
  dateRange: DateRange | undefined;
};

type FilterOption = {
  value: string;
  label: string;
  searchText?: string;
};

interface FiltersPanelProps {
  onApplyFilters?: (filters: DashboardFilters) => void;
}

export default function FiltersPanel({ onApplyFilters }: FiltersPanelProps) {
  const tenantId = useAuthStore((state) => state.tenantId);
  const [isOpen, setIsOpen] = useState(false);
  const [bodyOverflow, setBodyOverflow] = useState<"hidden" | "visible">(
    "hidden",
  );
  const overflowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = () => {
    if (overflowTimerRef.current) clearTimeout(overflowTimerRef.current);
    if (isOpen) {
      setBodyOverflow("hidden");
      setIsOpen(false);
    } else {
      setIsOpen(true);
      overflowTimerRef.current = setTimeout(
        () => setBodyOverflow("visible"),
        320,
      );
    }
  };

  const { control, watch, setValue, handleSubmit } = useForm<FiltersFormValues>(
    {
      defaultValues: {
        distributors: [],
        rmm: null,
        quarter: "",
        dateRange: undefined,
      },
    },
  );

  const dateRange = watch("dateRange");

  /* =========================
     DISTRIBUTOR LOGIC
  ========================== */

  const [distributorOptions, setDistributorOptions] = useState<FilterOption[]>(
    [],
  );
  const [distributorSearch, setDistributorSearch] = useState("");
  const distributorRequestIdRef = useRef(0);

  const loadDistributors = useCallback(
    async (query: string) => {
      if (!tenantId) return;

      const requestId = ++distributorRequestIdRef.current;

      const data = await fetchQuery<DistributorsQueryType>(
        environment,
        DistributorsQuery,
        {
          filters: { tenantId },
          q: query || null,
          first: 50,
        },
      ).toPromise();

      if (distributorRequestIdRef.current !== requestId) return;

      const options =
        data?.distributors?.edges
          ?.map((e) => e?.node)
          .filter(Boolean)
          .map((node) => ({
            value: node!.id,
            label: node!.name ?? node!.email ?? node!.id,
            searchText: [node!.name, node!.email].filter(Boolean).join(" "),
          })) ?? [];

      setDistributorOptions(options);
    },
    [tenantId],
  );

  useEffect(() => {
    void loadDistributors(distributorSearch.trim());
  }, [loadDistributors, distributorSearch]);

  /* =========================
     RMM LOGIC (dinámico con q)
  ========================== */

  const [rmmOptions, setRmmOptions] = useState<FilterOption[]>([]);
  const [rmmSearch, setRmmSearch] = useState("");
  const rmmRequestIdRef = useRef(0);

  const loadRmm = useCallback(
    async (query: string) => {
      if (!tenantId) return;

      const requestId = ++rmmRequestIdRef.current;

      const data = await fetchQuery<RmmClientsQueryType>(
        environment,
        RmmClientsQuery,
        {
          tenantId,
          q: query || null,
        },
      ).toPromise();

      if (rmmRequestIdRef.current !== requestId) return;

      const options =
        data?.rmmClients?.map((rmm) => ({
          value: rmm.id,
          label: rmm.firstName
            ? `${rmm.firstName} ${rmm.lastName}`
            : rmm.username,
          searchText: [rmm.firstName, rmm.lastName, rmm.username]
            .filter(Boolean)
            .join(" "),
        })) ?? [];

      setRmmOptions(options);
    },
    [tenantId],
  );

  useEffect(() => {
    void loadRmm(rmmSearch.trim());
  }, [loadRmm, rmmSearch]);

  /* =========================
     APPLY FILTERS
  ========================== */
  const handleApply = handleSubmit((values) => {
    const normalized: DashboardFilters = {
      distributorIds: values.distributors?.length ? values.distributors : null,
      rmmAsignedId: values.rmm || null,
      quarter: values.quarter || null,
      startDate: values.dateRange?.from
        ? format(values.dateRange.from, "yyyy-MM-dd")
        : null,
      endDate: values.dateRange?.to
        ? format(values.dateRange.to, "yyyy-MM-dd")
        : null,
    };

    onApplyFilters?.(normalized);
  });

  /* =========================
     UI
  ========================== */

  return (
    <div className="w-full relative z-20">
      {/* Card wrapper */}
      <div className="bg-base-100/50 rounded-xl border border-base-300 shadow-sm">
        {/* HEADER */}
        <div
          onClick={handleToggle}
          className="flex items-center justify-between py-4 px-6 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Funnel size={18} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-base-content">Filters</h3>
          </div>

          <ChevronDown
            size={20}
            className={cn(
              "transition-transform duration-300",
              isOpen ? "rotate-180" : "rotate-0",
            )}
          />
        </div>

        {/* BODY — animated with controlled overflow */}
        <div
          style={{
            maxHeight: isOpen ? "600px" : "0px",
            overflow: bodyOverflow,
            transition: "max-height 0.3s ease",
          }}
        >
          <div className="px-6 pb-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <FormMultiAutocomplete
                control={control}
                name="distributors"
                label="Distributors"
                options={distributorOptions}
                onSearch={setDistributorSearch}
                placeholder="Search distributors..."
              />

              <FormAutocomplete
                control={control}
                name="rmm"
                label="RMM"
                options={rmmOptions}
                onSearch={setRmmSearch}
                placeholder="Search RMM..."
              />

              <FormAutocomplete
                control={control}
                name="quarter"
                label="Quarter"
                placeholder="Select Quarter"
                options={[
                  { value: "Q1", label: "Q1 - Jan, Feb, Mar" },
                  { value: "Q2", label: "Q2 - Apr, May, Jun" },
                  { value: "Q3", label: "Q3 - Jul, Aug, Sep" },
                  { value: "Q4", label: "Q4 - Oct, Nov, Dec" },
                ]}
                showClear
              />

              <DateRangePicker
                value={dateRange}
                onChange={(range) =>
                  setValue("dateRange", range, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleApply}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
