import { motion } from "framer-motion";
import { Controller } from "react-hook-form";
import { useEffect, useState } from "react";
import type { Control } from "react-hook-form";
import type { SparkFormData } from "../schema/schema";

interface ProductItem {
  id: string;
  name: string;
  desc: string;
  image?: string | null;
  productTypeId: string;
}

interface Props {
  name: keyof SparkFormData;
  control: Control<SparkFormData, any, SparkFormData>;
  products: ProductItem[];
  productTypes: {
    id: string;
    name: string;
  }[];
  label: string;
  loadingProducts?: boolean;
  hasMoreProducts?: boolean;
  totalProductsCount?: number;
  onLoadMoreProducts?: () => void;
  selectedType?: string;
  onSelectedTypeChange?: (productTypeId: string | null) => void;
}

const ITEMS_PER_PAGE = 9;

export default function ProductSelector({
  name,
  control,
  products,
  productTypes,
  label,
  loadingProducts = false,
  hasMoreProducts = false,
  totalProductsCount = 0,
  onLoadMoreProducts,
  selectedType = "all",
  onSelectedTypeChange,
}: Props) {
  const [page, setPage] = useState(1);
  const [pendingNext, setPendingNext] = useState(false);

  const loadedPages = Math.max(1, Math.ceil(products.length / ITEMS_PER_PAGE));
  const totalPages = Math.max(
    1,
    Math.ceil((totalProductsCount || products.length) / ITEMS_PER_PAGE),
  );
  const pageItems = products.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (!pendingNext || loadingProducts) return;
    if (loadedPages <= page) return;

    setPage((p) => Math.min(p + 1, totalPages));
    setPendingNext(false);
  }, [pendingNext, loadingProducts, loadedPages, page, totalPages]);

  const goNext = () => {
    if (page < loadedPages) {
      setPage((p) => p + 1);
      return;
    }

    if (hasMoreProducts && onLoadMoreProducts && !loadingProducts) {
      setPendingNext(true);
      onLoadMoreProducts();
      return;
    }

    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  };
  const goPrev = () => setPage((p) => Math.max(p - 1, 1));

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const selected = (field.value as string[]) || [];

        const toggle = (id: string) => {
          field.onChange(
            selected.includes(id)
              ? selected.filter((x: string) => x !== id)
              : [...selected, id]
          );
        };

        return (
          <div className="w-full space-y-6">
            <h3 className="font-semibold text-lg">{label}</h3>

            {/* FILTER BY PRODUCT TYPE */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  Filter by Product Type
                </span>
              </label>

              <select
                className="select select-bordered w-full"
                value={selectedType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  onSelectedTypeChange?.(nextType === "all" ? null : nextType);
                  setPendingNext(false);
                  setPage(1);
                }}
              >
                <option value="all">All Product Types</option>
                {productTypes.map((pt: { id: string; name: string }) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pageItems.map((p) => {
                const active = selected.includes(p.id);

                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggle(p.id)}
                    className={`
                      cursor-pointer rounded-2xl border backdrop-blur-lg 
                      p-5 flex flex-col items-center space-y-3
                      transition-all shadow-sm hover:shadow-xl
                      ${
                        active
                          ? "border-primary bg-primary/10"
                          : "border-base-300"
                      }
                    `}
                  >
                    {p.image ? (
                      <motion.img
                        src={p.image}
                        alt={p.name}
                        className="h-24 object-contain"
                        whileHover={{ scale: 1.1 }}
                      />
                    ) : (
                      <div className="h-24 w-24 flex items-center justify-center rounded-xl bg-base-200 text-xs opacity-60">
                        No image
                      </div>
                    )}

                    <div className="text-center space-y-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs opacity-70">{p.desc}</p>
                    </div>

                    <input
                      type="checkbox"
                      readOnly
                      checked={active}
                      className="checkbox checkbox-primary"
                    />

                    {error && (
                      <p className="text-xs text-error mt-1">{error.message}</p>
                    )}
                  </motion.div>
                );
              })}

              {!loadingProducts && pageItems.length === 0 && (
                <p className="text-sm opacity-70 col-span-full">
                  No products found.
                </p>
              )}
            </div>

            {/* PAGINATION */}
            {(products.length > ITEMS_PER_PAGE || hasMoreProducts) && (
              <div className="flex justify-center items-center gap-4 mt-4">
                <button
                  className="btn btn-sm btn-outline"
                  onClick={goPrev}
                  disabled={page === 1}
                >
                  Prev
                </button>

                <span className="text-sm opacity-70">
                  Page {page} / {totalPages}
                </span>

                <button
                  className="btn btn-sm btn-outline"
                  onClick={goNext}
                  disabled={page === totalPages && !hasMoreProducts}
                >
                  Next
                </button>
              </div>
            )}

            {loadingProducts && (
              <div className="flex justify-center mt-2">
                <span className="loading loading-spinner loading-xs" />
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
