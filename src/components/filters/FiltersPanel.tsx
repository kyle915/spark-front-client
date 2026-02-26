import { useCallback, useEffect, useRef, useState } from "react";
import { Funnel, ChevronDown } from "lucide-react";
import { DateRangePicker } from "../ui/daterange-picker";
import type { DateRange } from "react-day-picker";
import { useForm } from "react-hook-form";
import { fetchQuery } from "react-relay";
import environment from "@api/relay/environment";
import { DistributorsQuery } from "@api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
import { RetailersQuery } from "@api/queries/RetailersQuery";
import type { RetailersQuery as RetailersQueryType } from "@api/queries/__generated__/RetailersQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import FormAutocomplete from "@shared/FormAutocomplete";
import { cn } from "@/lib/utils";

export type FilterOption = {
  value: string;
  label: string;
  searchText?: string;
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

type FiltersFormValues = Omit<FiltersState, "distributor" | "rmm"> & {
  distributor: string | null;
  rmm: string | null;
};

export default function FiltersPanel({
  distributors = [],
  rmmOptions = [],
  quarterOptions = [],
  onApplyFilters,
}: FiltersPanelProps) {
  const tenantId = useAuthStore((state) => state.tenantId);
  const [isOpen, setIsOpen] = useState(false);
  const { control, register, watch, setValue, handleSubmit } =
    useForm<FiltersFormValues>({
      defaultValues: {
        distributor: "",
        rmm: "",
        quarter: "",
        dateRange: undefined,
      },
    });

  const dateRange = watch("dateRange");
  const [distributorSearch, setDistributorSearch] = useState("");
  const [retailerSearch, setRetailerSearch] = useState("");
  const [distributorOptions, setDistributorOptions] =
    useState<FilterOption[]>(distributors);
  const [retailerOptions, setRetailerOptions] =
    useState<FilterOption[]>(rmmOptions);
  const [isLoadingDistributors, setIsLoadingDistributors] = useState(false);
  const [isLoadingRetailers, setIsLoadingRetailers] = useState(false);
  const distributorRequestIdRef = useRef(0);
  const retailerRequestIdRef = useRef(0);

  const loadDistributors = useCallback(
    async (query: string) => {
      const requestId = ++distributorRequestIdRef.current;
      setIsLoadingDistributors(true);
      try {
        const data = await fetchQuery<DistributorsQueryType>(
          environment,
          DistributorsQuery,
          {
            filters: { tenantId: tenantId ?? null },
            q: query || null,
            first: 100,
          },
        ).toPromise();

        if (distributorRequestIdRef.current !== requestId) return;
        const options =
          data?.distributors?.edges
            ?.map((edge) => edge?.node)
            .filter((node): node is NonNullable<typeof node> => Boolean(node))
            .map((node) => ({
              value: node.id,
              label: node.name ?? node.email ?? node.id,
              searchText: [node.name, node.email].filter(Boolean).join(" "),
            })) ?? [];

        setDistributorOptions(options);
      } catch {
        if (distributorRequestIdRef.current !== requestId) return;
        setDistributorOptions([]);
      } finally {
        if (distributorRequestIdRef.current === requestId) {
          setIsLoadingDistributors(false);
        }
      }
    },
    [tenantId],
  );

  const loadRetailers = useCallback(
    async (query: string) => {
      const requestId = ++retailerRequestIdRef.current;
      setIsLoadingRetailers(true);
      try {
        const data = await fetchQuery<RetailersQueryType>(
          environment,
          RetailersQuery,
          {
            filters: { tenantId: tenantId ?? null },
            q: query || null,
            first: 100,
          },
        ).toPromise();

        if (retailerRequestIdRef.current !== requestId) return;
        const options =
          data?.retailers?.edges
            ?.map((edge) => edge?.node)
            .filter((node): node is NonNullable<typeof node> => Boolean(node))
            .map((node) => ({
              value: node.id,
              label: node.name ?? node.id,
              searchText: [node.name, node.address, node.storeContact]
                .filter(Boolean)
                .join(" "),
            })) ?? [];

        setRetailerOptions(options);
      } catch {
        if (retailerRequestIdRef.current !== requestId) return;
        setRetailerOptions([]);
      } finally {
        if (retailerRequestIdRef.current === requestId) {
          setIsLoadingRetailers(false);
        }
      }
    },
    [tenantId],
  );

  useEffect(() => {
    if (!tenantId) {
      setDistributorOptions(distributors);
    }
  }, [distributors, tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setRetailerOptions(rmmOptions);
    }
  }, [rmmOptions, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    setDistributorSearch("");
    setRetailerSearch("");
    setValue("distributor", "");
    setValue("rmm", "");
  }, [setValue, tenantId]);

  useEffect(() => {
    void loadDistributors(distributorSearch.trim());
  }, [distributorSearch, loadDistributors]);

  useEffect(() => {
    void loadRetailers(retailerSearch.trim());
  }, [loadRetailers, retailerSearch]);

  const handleApply = handleSubmit((values) => {
    const nextFilters: FiltersState = {
      ...values,
      distributor: values.distributor ?? "",
      rmm: values.rmm ?? "",
    };
    onApplyFilters?.(nextFilters);
  });

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

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-base-content/60">
              {isOpen ? "Hide" : "Show"}
            </span>

            <ChevronDown
              size={20}
              className={cn(
                "transition-transform duration-300",
                isOpen ? "rotate-180" : "rotate-0",
              )}
            />
          </div>
        </div>

        {/* BODY */}
        <div className="collapse-content mt-2 overflow-visible">
          <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
            {/* Distributor */}
            <FormAutocomplete<FiltersFormValues>
              control={control}
              name="distributor"
              label="Distributor"
              options={distributorOptions}
              onSearch={setDistributorSearch}
              placeholder={
                isLoadingDistributors
                  ? "Loading distributors..."
                  : "Search distributor..."
              }
            />

            {/* Retailer */}
            <FormAutocomplete<FiltersFormValues>
              control={control}
              name="rmm"
              label="Rmm"
              options={retailerOptions}
              onSearch={setRetailerSearch}
              placeholder={
                isLoadingRetailers ? "Loading rmm..." : "Search rmm..."
              }
            />

            {/* Quarter */}
            <div className="form-control">
              <label className="label text-sm font-medium">Quarter</label>
              <select
                className="input input-bordered w-full"
                {...register("quarter")}
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
                value={dateRange}
                onChange={(range) =>
                  setValue("dateRange", range, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
              />
            </div>
          </div>

          {/* APPLY BUTTON */}
          <div className="flex justify-end pt-2 pb-1">
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
