import { motion } from "framer-motion";

export default function SideSummary({
  values,
  progress,
}: {
  values: any;
  progress: number;
}) {
  const products = values.skus || [];

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full md:w-80 p-6 rounded-2xl bg-base-100/70 backdrop-blur-xl 
                 shadow-lg border border-base-300/40 space-y-6 sticky top-4"
    >
      {/* Title */}
      <h2 className="font-bold text-xl">Request Summary</h2>

      {/* Products */}
      <section>
        <h3 className="text-sm font-semibold opacity-70">Selected Products</h3>

        <div className="mt-2 text-sm">
          {products.length === 0 ? (
            <p className="opacity-50">No products selected</p>
          ) : (
            <ul className="list-disc ml-4 space-y-1">
              {products.map((p: string) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Progress */}
      <section>
        <h3 className="text-sm font-semibold opacity-70">Completed Fields</h3>

        <div className="w-full h-2 bg-base-300 rounded-full mt-2 overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <p className="text-xs opacity-50 mt-1">
          {Math.round(progress)}% completed
        </p>
      </section>

      {/* Tips */}
      <section className="text-xs opacity-60 space-y-2">
        <p>✓ Fill out all required fields</p>
        <p>✓ Review your information before submitting</p>
        <p>✓ You will receive a confirmation email</p>
      </section>
    </motion.aside>
  );
}
