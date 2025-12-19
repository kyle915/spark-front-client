import { Controller, useForm } from "react-hook-form";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import FormInputText from "@/shared/FormInputText";
import FormInputTime from "@/shared/FormInputTime";
import FormAutocomplete from "@/shared/FormAutocomplete";
import FormDatePicker from "@/shared/FormDatePicker";
import EditableLocationMap from "@/shared/EditableLocationMap";
import FormCheckbox from "@/shared/FormCheckbox";
import { ArrowLeftIcon, PencilIcon } from "@heroicons/react/24/solid";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { SaveIcon } from "lucide-react";

import type { Path, PathValue } from "react-hook-form";

export interface RequestFormValues {
  name: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  address: string;
  coordinates?: number[] | null;
  timezoneId?: string | null;
  retailerId?: string | null;
  distributorId?: string | null;
  requestTypeId?: string | null;

  // Create mode fields
  clientName?: string;
  clientEmail?: string;
  distributorName?: string;
  distributorEmail?: string;
  retailerName?: string;
  retailerAddress?: string;
  retailerStoreContact?: string;
  storeManagerName?: string;
  storeManagerPhone?: string;

  // Details
  isTableNeeded?: boolean;
  tableSize?: string;

  // Products
  products?: string[];
}

interface CatalogItem {
  id: string;
  name: string;
}

interface ProductItem {
  id: string;
  name: string;
  image?: string | null;
  productType?: { id: string } | null;
}

interface TimezoneItem {
  id: string;
  name: string;
  code: string;
  offset: number;
}

interface RequestFormProps {
  mode: "create" | "edit";
  onSubmit: (data: RequestFormValues) => void;
  defaultValues?: Partial<RequestFormValues>;
  clients?: CatalogItem[];
  retailers?: CatalogItem[];
  distributors?: CatalogItem[];
  requestTypes: CatalogItem[];
  timezones?: TimezoneItem[];
  productTypes?: CatalogItem[];
  products?: ProductItem[];
}

export default function RequestForm({
  mode,
  onSubmit,
  defaultValues = {},
  retailers = [],
  distributors = [],
  requestTypes,
  timezones = [],
  productTypes = [],
  products = [],
}: RequestFormProps) {
  const safeDefaultValues: RequestFormValues = {
    name: "",
    date: "",
    startTime: "",
    endTime: "",
    address: "",
    coordinates: null,
    timezoneId: null,
    retailerId: null,
    distributorId: null,
    requestTypeId: null,

    clientName: "",
    clientEmail: "",
    distributorName: "",
    distributorEmail: "",
    retailerName: "",
    retailerAddress: "",
    retailerStoreContact: "",
    storeManagerName: "",
    storeManagerPhone: "",

    isTableNeeded: false,
    tableSize: "",
    products: [],

    ...defaultValues,
  };

  const { handleSubmit, control, watch, setValue, reset, formState } =
    useForm<RequestFormValues>({
      defaultValues: safeDefaultValues,
    });

  const isDirty = formState.isDirty;

  useEffect(() => {
    if (mode === "edit" && Object.keys(defaultValues).length > 0) {
      reset({
        name: defaultValues.name ?? "",
        date: defaultValues.date ?? "",
        startTime: defaultValues.startTime ?? "",
        endTime: defaultValues.endTime ?? "",
        address: defaultValues.address ?? "",
        coordinates: defaultValues.coordinates ?? null,
        timezoneId: defaultValues.timezoneId ?? null,
        retailerId: defaultValues.retailerId ?? null,
        distributorId: defaultValues.distributorId ?? null,
        requestTypeId: defaultValues.requestTypeId ?? null,
      });
    }
  }, [mode, defaultValues, reset]);

  const [selectedProductType, setSelectedProductType] = useState<string>("");

  const isTableNeeded = watch("isTableNeeded");
  const selectedProducts = watch("products") || [];

  const filteredProducts = useMemo(() => {
    if (!selectedProductType) return products;
    return products.filter((p) => p.productType?.id === selectedProductType);
  }, [products, selectedProductType]);

  const toggleProduct = (productId: string) => {
    const current = selectedProducts;
    if (current.includes(productId)) {
      noteSet(
        "products",
        current.filter((id) => id !== productId)
      );
    } else {
      noteSet("products", [...current, productId]);
    }
  };

  const noteSet = <TFieldName extends Path<RequestFormValues>>(
    name: TFieldName,
    value: PathValue<RequestFormValues, TFieldName>
  ) => {
    setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
        <div className="p-8 md:p-10 space-y-8">
          {/* HEADER (match View Request) */}
          <div className="flex flex-col gap-5 border-b border-base-100/20">
            {/* top row */}
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/requests/list"
                className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to list
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  type="button"
                  className="btn btn-sm btn-outline"
                  to="/requests/list"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={!isDirty}
                >
                  <SaveIcon className="w-4 h-4" />
                  Save changes
                </button>
              </div>
            </div>

            {/* title row */}
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                  <PencilIcon className="w-6 h-6" />
                  <h1>
                    {mode === "edit"
                      ? defaultValues?.name ?? "Edit Request"
                      : "Create Request"}
                  </h1>
                </span>
              </div>
              <p className="text-base-content/70 text-sm mt-2">
                {mode === "edit"
                  ? "Update the request information. Changes will apply immediately after saving."
                  : "Fill out the form below to create a new request."}
              </p>
            </div>
          </div>

          {/* BASIC INFORMATION */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Basic Information</p>
              <span className="text-xs text-base-content/60">
                Required fields
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInputText<RequestFormValues>
                name="name"
                control={control}
                placeholder="Enter name"
                label="Name"
                rules={{ required: "Name is required" }}
              />

              <FormAutocomplete<RequestFormValues>
                name="requestTypeId"
                control={control}
                label="Request Type"
                placeholder="Search request type..."
                options={requestTypes.map((rt) => ({
                  value: rt.id,
                  label: rt.name,
                }))}
                rules={{ required: "Request Type is required" }}
              />

              <FormDatePicker<RequestFormValues>
                name="date"
                control={control}
                label="Date"
                placeholder="MM/DD/YYYY"
                rules={{ required: "Date is required" }}
              />

              <FormAutocomplete<RequestFormValues>
                name="timezoneId"
                control={control}
                label="Timezone"
                placeholder="Search timezone..."
                options={timezones.map((tz) => {
                  const sign = tz.offset >= 0 ? "+" : "-";
                  const abs = Math.abs(tz.offset);
                  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
                  const minutes = String(abs % 60).padStart(2, "0");
                  return {
                    value: tz.id,
                    label: `${tz.name}-${tz.code} (UTC${sign}${hours}:${minutes})`,
                  };
                })}
                rules={{ required: "Timezone is required" }}
              />

              <FormInputTime<RequestFormValues>
                name="startTime"
                control={control}
                label="Start Time"
                rules={{ required: "Start Time is required" }}
              />

              <FormInputTime<RequestFormValues>
                name="endTime"
                control={control}
                label="End Time"
                rules={{ required: "End Time is required" }}
              />

              <div className="md:col-span-2">
                <FormInputText<RequestFormValues>
                  name="address"
                  placeholder="Enter address"
                  control={control}
                  label="Address"
                  rules={{ required: "Address is required" }}
                />
              </div>
            </div>
          </section>

          {/* ENTITIES */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Entities</p>
              <span className="text-xs text-base-content/60">
                Retailer & Distributor
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {mode === "edit" ? (
                <>
                  <FormAutocomplete<RequestFormValues>
                    name="retailerId"
                    control={control}
                    label="Retailer"
                    placeholder="Search retailer..."
                    options={retailers.map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                  />
                  <FormAutocomplete<RequestFormValues>
                    name="distributorId"
                    control={control}
                    label="Distributor"
                    placeholder="Search distributor..."
                    options={distributors.map((d) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                  />
                </>
              ) : (
                <>
                  <FormInputText<RequestFormValues>
                    name="clientName"
                    control={control}
                    label="Client Name"
                    placeholder="John Doe"
                    rules={{ required: "Client Name is required" }}
                  />
                  <FormInputText<RequestFormValues>
                    name="clientEmail"
                    control={control}
                    label="Client Email"
                    placeholder="john.doe@example.com"
                    rules={{ required: "Client Email is required" }}
                  />

                  <FormInputText<RequestFormValues>
                    name="distributorName"
                    control={control}
                    label="Distributor Name"
                    placeholder="Distributor Inc."
                    rules={{ required: "Distributor Name is required" }}
                  />
                  <FormInputText<RequestFormValues>
                    name="distributorEmail"
                    control={control}
                    label="Distributor Email"
                    placeholder="distributor@example.com"
                    rules={{ required: "Distributor Email is required" }}
                  />

                  <FormInputText<RequestFormValues>
                    name="retailerName"
                    control={control}
                    label="Retailer Name"
                    placeholder="Retailer LLC"
                    rules={{ required: "Retailer Name is required" }}
                  />
                  <FormInputText<RequestFormValues>
                    name="retailerAddress"
                    control={control}
                    label="Retailer Address"
                    placeholder="123 Main St, City, Country"
                    rules={{ required: "Retailer Address is required" }}
                  />
                  <FormInputText<RequestFormValues>
                    name="retailerStoreContact"
                    control={control}
                    label="Retailer Store Contact"
                    placeholder="(e.g. Store phone / contact)"
                    rules={{ required: "Retailer Store Contact is required" }}
                  />

                  <FormInputText<RequestFormValues>
                    name="storeManagerName"
                    control={control}
                    label="Store Manager Name"
                    placeholder="Jane Smith"
                    rules={{ required: "Store Manager Name is required" }}
                  />
                  <FormInputText<RequestFormValues>
                    name="storeManagerPhone"
                    control={control}
                    label="Store Manager Phone"
                    placeholder="+1 234 567 8900"
                    rules={{ required: "Store Manager Phone is required" }}
                  />
                </>
              )}
            </div>
          </section>

          {/* DETAILS (CREATE ONLY) */}
          {mode === "create" && (
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <p className="font-semibold text-lg">Details</p>
              <div className="grid grid-cols-1 gap-4">
                <FormCheckbox<RequestFormValues>
                  name="isTableNeeded"
                  control={control}
                  label="Table Needed?"
                />
                {isTableNeeded && (
                  <FormInputText<RequestFormValues>
                    name="tableSize"
                    control={control}
                    label="Table Size"
                    placeholder="Enter table size"
                    type="number"
                    rules={{ required: "Table Size is required" }}
                  />
                )}
              </div>
            </section>
          )}

          {/* PRODUCTS (CREATE ONLY) */}
          {mode === "create" && products.length > 0 && (
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold text-lg">Products</p>

                <div className="w-56">
                  <select
                    className="select select-bordered select-sm w-full"
                    value={selectedProductType}
                    onChange={(e) => setSelectedProductType(e.target.value)}
                  >
                    <option value="">All Types</option>
                    {productTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`card bg-base-100 shadow-sm border cursor-pointer transition-all ${
                      selectedProducts.includes(product.id)
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-base-300 hover:border-primary/50"
                    }`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <div className="card-body p-4 items-center text-center">
                      <div className="w-16 h-16 mb-2 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-base-content/50">
                            No img
                          </span>
                        )}
                      </div>
                      <h4
                        className="text-sm font-medium truncate w-full"
                        title={product.name}
                      >
                        {product.name}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* LOCATION MAP */}
          <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-lg">Location</p>
            </div>

            <Controller
              name="coordinates"
              control={control}
              render={({ field }) => (
                <EditableLocationMap
                  coordinates={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </section>

          {/* FOOTER ACTIONS (optional but matches nice UX) */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <Link
              type="button"
              className="btn btn-sm btn-outline"
              to="/requests/list"
            >
              <XCircleIcon className="w-4 h-4" />
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!isDirty}
            >
              {mode === "edit" ? "Save changes" : "Create request"}
              <SaveIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
