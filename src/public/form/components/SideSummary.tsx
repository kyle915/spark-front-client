import { motion } from "framer-motion";

// Heroicons
import {
  CubeIcon,
  MapPinIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export default function SideSummary({
  values,
  progress,
  productsFull,
}: {
  values: any;
  progress: number;
  productsFull: any[];
}) {
  const selectedProductNames = (values.skus || []).map((skuId: string) => {
    const found = productsFull.find((p) => p.id === skuId);
    return found ? found.name : skuId;
  });
  const isComplete = progress >= 100;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full md:w-80 p-6 rounded-2xl bg-base-100/80 backdrop-blur-xl shadow-lg border border-base-300/40 sticky top-4 space-y-8"
    >
      <div className="space-y-1">
        <h2 className="font-bold text-xl flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-primary" />
          Request Summary
        </h2>
        <p className="text-xs opacity-70">
          A quick overview of your request details.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold opacity-70 flex items-center gap-2">
          <CubeIcon className="w-4 h-4 text-primary" />
          Selected Products
        </h3>

        {selectedProductNames.length === 0 ? (
          <p className="opacity-50 text-sm">No products selected</p>
        ) : (
          <ul className="space-y-2">
            {selectedProductNames.map((name: string, index: number) => (
              <li
                key={index}
                className="text-sm bg-base-200/40 px-3 py-2 rounded-lg border border-base-300/30 flex items-center gap-2"
              >
                <span className="text-primary font-bold">{index + 1}.</span>
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold opacity-70 flex items-center gap-2">
          <MapPinIcon className="w-4 h-4 text-primary" />
          Location
        </h3>

        {values.latitude && values.longitude ? (
          <div className="mt-2 text-xs bg-base-200/40 p-3 rounded-lg border border-base-300/30">
            <p>
              <span className="font-semibold">Lat:</span> {values.latitude}
            </p>
            <p>
              <span className="font-semibold">Lng:</span> {values.longitude}
            </p>
          </div>
        ) : (
          <p className="text-xs opacity-50">Not selected yet</p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold opacity-70">Completed Fields</h3>

        <div className="w-full h-2 bg-base-300 rounded-full mt-2 overflow-hidden">
          <motion.div
            className={`h-full ${isComplete ? "bg-green-500" : "bg-primary"}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <p
          className={`text-xs mt-1 flex items-center gap-1 ${
            isComplete ? "text-green-500" : "opacity-70"
          }`}
        >
          {isComplete ? (
            <>
              <CheckCircleIcon className="w-4 h-4" /> All fields completed
            </>
          ) : (
            <>
              <ExclamationTriangleIcon className="w-4 h-4" />{" "}
              {Math.round(progress)}% completed
            </>
          )}
        </p>
      </section>

      {/* TIPS */}
      <section className="text-xs opacity-60 space-y-2 border-t border-base-300/30 pt-3">
        <p>✓ Fill out all required fields</p>
        <p>✓ Review your information before submitting</p>
        <p>✓ You will receive a confirmation email</p>
      </section>
    </motion.aside>
  );
}
