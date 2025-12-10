import { Controller, useForm } from "react-hook-form";
import FormInputText from "@/shared/FormInputText";
import FormInputTime from "@/shared/FormInputTime";
import FormAutocomplete from "@/shared/FormAutocomplete";
import EditableLocationMap from "@/shared/EditableLocationMap";
import FormCheckbox from "@/shared/FormCheckbox";

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
  productType?: {
    id: string;
  } | null;
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

import { useState, useMemo } from "react";
import FormDatePicker from "@/shared/FormDatePicker";

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
  const { handleSubmit, control, watch, setValue } = useForm<RequestFormValues>(
    {
      defaultValues,
    }
  );

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
      setValue(
        "products",
        current.filter((id) => id !== productId)
      );
    } else {
      setValue("products", [...current, productId]);
    }
  };

  return (
    <form className="p-4 space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {/* Basic Info Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
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

          {/* New Date Picker Field */}
          <FormDatePicker<RequestFormValues>
            name="date"
            control={control}
            label="Date"
            placeholder="MM/DD/YYYY"
            rules={{ required: "Date is required" }}
          />

          {/* <FormInputText<RequestFormValues>
            name="date"
            control={control}
            placeholder="MM/DD/YYYY"
            label="Date"
            type="date"
            rules={{ required: "Date is required" }}
          /> */}
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
          <FormAutocomplete<RequestFormValues>
            name="timezoneId"
            control={control}
            label="Timezone"
            placeholder="Search timezone..."
            options={timezones.map((tz) => {
              const sign = tz.offset >= 0 ? "+" : "-";
              const absOffsetMinutes = Math.abs(tz.offset);
              const hours = Math.floor(absOffsetMinutes / 60);
              const minutes = absOffsetMinutes % 60;
              const hoursStr = String(hours).padStart(2, "0");
              const minutesStr = String(minutes).padStart(2, "0");
              return {
                value: tz.id,
                label: `${tz.name}-${tz.code} (UTC${sign}${hoursStr}:${minutesStr})`,
              };
            })}
            rules={{ required: "Timezone is required" }}
          />
          <FormInputText<RequestFormValues>
            name="address"
            placeholder="Enter address"
            control={control}
            label="Address"
            rules={{ required: "Address is required" }}
          />
        </div>
      </div>

      {/* Entities Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Entities</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {mode === "edit" ? (
            <>
              <FormAutocomplete<RequestFormValues>
                name="retailerId"
                control={control}
                label="Retailer"
                placeholder="Search retailer..."
                options={retailers.map((r) => ({ value: r.id, label: r.name }))}
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
              {/* Client */}
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

              {/* Distributor */}
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

              {/* Retailer */}
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
                placeholder="Retailer Store Contact"
                rules={{ required: "Retailer Store Contact is required" }}
              />

              {/* Store Manager */}
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
      </div>

      {/* Details Section */}
      {mode === "create" && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Details</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>
      )}

      {/* Products Section */}
      {mode === "create" && products.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Products</h3>
            <div className="w-48">
              <select
                className="select select-bordered select-sm w-full"
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
              >
                <option value="">All Types</option>
                {productTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
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
        </div>
      )}

      {/* Coordinates Map */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Location</h3>
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
      </div>

      <div className="flex justify-end pt-4">
        <button className="btn btn-primary" type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
