import { motion } from "framer-motion";
import { Controller } from "react-hook-form";
import { useState, useMemo } from "react";

interface ProductItem {
  id: string;
  name: string;
  desc: string;
  img: string;
  productTypeId: string;
}

interface Props<T> {
  name: any;
  control: any;
  products: ProductItem[];
  productTypes: any[];
  label: string;
}

const ITEMS_PER_PAGE = 6;

export default function ProductSelector<T>({
  name,
  control,
  products,
  productTypes,
  label,
}: Props<T>) {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filteredProducts = useMemo(() => {
    const list =
      selectedType === "all"
        ? products
        : products.filter((p) => p.productTypeId === selectedType);

    return list;
  }, [selectedType, products]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const pageItems = filteredProducts.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const goNext = () => setPage((p) => Math.min(p + 1, totalPages));
  const goPrev = () => setPage((p) => Math.max(p - 1, 1));

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selected = field.value || [];

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
                  setSelectedType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Product Types</option>
                {productTypes.map((pt: any) => (
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
                    {p.img ? (
                      <motion.img
                        src={p.img}
                        className="h-24"
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
                  </motion.div>
                );
              })}
            </div>

            {/* PAGINATION */}
            {filteredProducts.length > ITEMS_PER_PAGE && (
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
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
