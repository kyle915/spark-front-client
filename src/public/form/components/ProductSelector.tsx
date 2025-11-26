import { motion } from "framer-motion";
import { Controller } from "react-hook-form";

interface ProductItem {
  id: string;
  name: string;
  desc: string;
  img: string;
}

interface Props<T> {
  name: any;
  control: any;
  products: ProductItem[];
  label: string;
}

export default function ProductSelector<T>({
  name,
  control,
  products,
  label,
}: Props<T>) {
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
          <div className="w-full">
            <h3 className="font-semibold text-lg mb-4">{label}</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {products.map((p) => {
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
                    <motion.img
                      src={p.img}
                      className="h-24"
                      whileHover={{ scale: 1.1 }}
                    />

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
          </div>
        );
      }}
    />
  );
}
