import { useSparkForm } from "../hooks/useSparkForm";
import { Step1Basic, Step2Products, Step4Details, Step3Clients } from "./steps";
import { useSparkSubmit } from "../hooks";

interface SparkFormProps {
  requestTypes: {
    id: string;
    name: string;
  }[];
  billingEntities: {
    id: string;
    name: string;
  }[];
  onBillingEntitySearch: (value: string) => void;
  states: {
    id: string;
    name: string;
  }[];
  onStateSearch: (value: string) => void;
  onStateChange: (value: string) => void;
  onRetailerSearch: (value: string) => void;
  onNationalRetailerChange: (value: boolean) => void;
  distributors: {
    id: string;
    name: string;
    location?: {
      id: string;
      name: string;
    } | null;
  }[];
  retailers: {
    id: string;
    name: string;
    location?: {
      id: string;
      name: string;
    } | null;
  }[];
  products: {
    id: string;
    name: string;
    image?: string | null;
    productType: {
      id: string;
      name: string;
    };
  }[];
  productsLoading?: boolean;
  productsHasMore?: boolean;
  productsTotalCount?: number;
  onLoadMoreProducts?: () => void;
  selectedProductTypeId?: string | null;
  onProductTypeChange?: (productTypeId: string | null) => void;
  productTypes: {
    id: string;
    name: string;
  }[];
  tenantId: string;
  requestUrlName: string;
  timeZones: {
    id: string;
    name: string;
    code: string;
    offset: number;
  }[];
}

export default function SparkForm(props: SparkFormProps) {
  const {
    requestTypes,
    billingEntities,
    onBillingEntitySearch,
    states,
    onStateSearch,
    onStateChange,
    onRetailerSearch,
    onNationalRetailerChange,
    products,
    productsLoading = false,
    productsHasMore = false,
    productsTotalCount = 0,
    onLoadMoreProducts,
    selectedProductTypeId = null,
    onProductTypeChange,
    productTypes,
    distributors,
    retailers,
    tenantId,
    requestUrlName,
    timeZones,
  } = props;

  const {
    control,
    watch,
    reset,
    trigger,
    setValue,
    formState: { isValid },
  } = useSparkForm();
  const values = watch();
  const { handleSubmit, loading } = useSparkSubmit(
    tenantId,
    () => {
      reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    timeZones,
  );

  const handleFormSubmit = async () => {
    // Trigger validation for all fields
    const isValid = await trigger();
    if (isValid) {
      handleSubmit(values);
    } else {
      // Scroll to top or first error if needed
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-24 md:pb-32 px-4 sm:px-6 pt-6">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fadeUp 0.6s ease-out forwards;
          opacity: 0;
        }
        input:focus, select:focus, button:focus-visible {
          box-shadow: 0 0 0 2px var(--fallback-p,oklch(var(--p))), 0 0 15px rgba(oklch(var(--p)), 0.15);
          outline: none;
        }
      `}</style>

      <div className="flex flex-col gap-8 md:gap-12">
        <section 
          className="animate-fade-up card bg-base-100/70 backdrop-blur-md p-5 sm:p-6 md:p-8 shadow-xl rounded-2xl border border-base-300/50"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">01</span>
              Basic Information
            </h2>
            <p className="opacity-60 mt-1 text-sm pl-10">Tell us about the visit</p>
          </div>
          <Step1Basic
            control={control}
            timeZones={timeZones}
            setValue={setValue}
            requestUrlName={requestUrlName}
            billingEntities={billingEntities}
            onBillingEntitySearch={onBillingEntitySearch}
          />
        </section>

        <section 
          className="animate-fade-up card bg-base-100/70 backdrop-blur-md p-5 sm:p-6 md:p-8 shadow-xl rounded-2xl border border-base-300/50"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">02</span>
              Products
            </h2>
            <p className="opacity-60 mt-1 text-sm pl-10">Choose SKUs</p>
          </div>
          <Step2Products
            control={control}
            products={products}
            productsLoading={productsLoading}
            productsHasMore={productsHasMore}
            productsTotalCount={productsTotalCount}
            onLoadMoreProducts={onLoadMoreProducts}
            selectedProductTypeId={selectedProductTypeId}
            onProductTypeChange={onProductTypeChange}
            productTypes={productTypes}
          />
        </section>

        <section 
          className="animate-fade-up card bg-base-100/70 backdrop-blur-md p-5 sm:p-6 md:p-8 shadow-xl rounded-2xl border border-base-300/50"
          style={{ animationDelay: '0.3s' }}
        >
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">03</span>
              Client Details
            </h2>
            <p className="opacity-60 mt-1 text-sm pl-10">
              Select distributor and retailer
            </p>
          </div>
          <Step3Clients
            control={control}
            setValue={setValue}
            requestTypes={requestTypes}
            states={states}
            onStateSearch={onStateSearch}
            onStateChange={onStateChange}
            onRetailerSearch={onRetailerSearch}
            onNationalRetailerChange={onNationalRetailerChange}
            distributors={distributors}
            retailers={retailers}
            requestUrlName={requestUrlName}
          />
        </section>

        <section 
          className="animate-fade-up card bg-base-100/70 backdrop-blur-md p-5 sm:p-6 md:p-8 shadow-xl rounded-2xl border border-base-300/50"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">04</span>
              Extra Details
            </h2>
            <p className="opacity-60 mt-1 text-sm pl-10">Optional details</p>
          </div>
          <Step4Details
            control={control}
            setValue={setValue}
            requestUrlName={requestUrlName}
            values={values}
          />
        </section>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-base-100/95 backdrop-blur-xl border-t border-base-300 z-50 flex justify-center shadow-[0_-8px_30px_rgba(0,0,0,0.1)]">
        <div className="w-full max-w-4xl flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="font-semibold">Ready to submit?</p>
            <p className="text-xs opacity-70">
              Review your information before submitting
            </p>
          </div>
          <button
            className={`btn w-full sm:w-auto px-10 transition-all duration-300 border-0 text-white font-bold
              ${
                isValid
                  ? "transform bg-linear-to-r from-primary to-secondary shadow-[0_0_15px_rgba(100,255,100,0.3)] hover:scale-110 hover:-translate-y-1 hover:shadow-[0_10px_25px_rgba(100,255,100,0.6)]"
                  : "bg-base-300 opacity-50 cursor-not-allowed"
              }
            `}
            onClick={handleFormSubmit}
            disabled={!isValid || loading}
          >
            {loading ? "Submitting..." : "Submit Request"}
            {loading && <span className="loading loading-spinner ml-2"></span>}
          </button>
        </div>
      </div>
    </div>
  );
}
