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

export type DashboardFilters = {
  distributorId: string | null;
  rmmAsignedId: string | null;
  quarter: string | null;
  startDate: string | null;
  endDate: string | null;
};

type FiltersFormValues = {
  distributor: string | null;
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

  const { control, register, watch, setValue, handleSubmit } =
    useForm<FiltersFormValues>({
      defaultValues: {
        distributor: null,
        rmm: null,
        quarter: "",
        dateRange: undefined,
      },
    });

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
      distributorId: values.distributor || null,
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
    <div className="w-full">
      <div
        className={cn(
          "collapse bg-base-100/50 rounded-xl border border-base-300 shadow-sm overflow-visible transition-all duration-300",
          isOpen && "collapse-open",
        )}
      >
        {/* HEADER */}
        <div
          onClick={() => setIsOpen((prev) => !prev)}
          className="collapse-title flex items-center justify-between py-4 cursor-pointer"
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

        {/* BODY */}
        <div className="collapse-content mt-2 overflow-visible">
          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FormAutocomplete
              control={control}
              name="distributor"
              label="Distributor"
              options={distributorOptions}
              onSearch={setDistributorSearch}
              placeholder="Search distributor..."
            />

            <FormAutocomplete
              control={control}
              name="rmm"
              label="RMM"
              options={rmmOptions}
              onSearch={setRmmSearch}
              placeholder="Search RMM..."
            />

            <div className="form-control">
              <label className="label text-sm font-medium">Quarter</label>
              <select
                className="input input-bordered w-full"
                {...register("quarter")}
              >
                <option value="">Select Quarter</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </div>

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

          <div className="flex justify-end pt-3">
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
  );
}
