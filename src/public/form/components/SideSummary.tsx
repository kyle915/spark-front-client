import { motion } from "framer-motion";
import {
  CalendarIcon,
  UserIcon,
  MapPinIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { dateFormat } from "../utils/toDate";

export default function SideSummary({
  values,
  progress,
  productsFull,
  clients,
  distributors,
  retailers,
}: {
  values: any;
  progress: number;
  productsFull: any[];
  clients: any[];
  distributors: any[];
  retailers: any[];
}) {
  const isComplete = progress >= 100;

  const selectedProducts = (values.skus || []).map((id: string) => {
    const found = productsFull.find((p) => p.id === id);
    return found ? found.name : id;
  });

  const findName = (list: any[], id: string) => {
    const item = list.find((x) => x.id === id);
    return item ? item.name : id;
  };

  const clientName = values.client ? findName(clients, values.client) : null;

  const distributorName = values.distributor
    ? findName(distributors, values.distributor)
    : null;

  const retailerName = values.retailer
    ? findName(retailers, values.retailer)
    : null;

  const steps = [
    {
      title: "Basic Information",
      done:
        values.name &&
        values.date &&
        values.start_time &&
        values.latitude &&
        values.longitude &&
        values.address,
    },
    {
      title: "Products",
      done:
        values.skus?.length > 0 &&
        values.client &&
        values.distributor &&
        values.retailer &&
        values.request_type,
    },
    {
      title: "Extra Details",
      done:
        values.details?.[0]?.isTableNeeded === "false" ||
        (values.details?.[0]?.isTableNeeded === "true" &&
          values.details?.[0]?.tableSize),
    },
  ];

  const warnings = [];

  if (!values.skus?.length) warnings.push("No products selected.");
  if (!values.latitude || !values.longitude)
    warnings.push("Select a location on the map.");
  if (!values.date) warnings.push("Visit date is missing.");
  if (!values.client) warnings.push("Client is not selected.");
  if (!values.request_type) warnings.push("Request type is required.");

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full md:w-80 p-6 rounded-2xl bg-base-100/80 backdrop-blur-xl shadow-lg border border-base-300/40 sticky top-4 space-y-8"
    >
      {/* HEADER */}
      <div className="space-y-1">
        <h2 className="font-bold text-xl flex items-center gap-2">
          <ClipboardDocumentListIcon className="w-5 h-5 text-primary" />
          Request Overview
        </h2>
        <p className="text-xs opacity-70">
          A professional summary of your request.
        </p>
      </div>

      {/* DATE + BASIC INFO */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold opacity-70 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" />
          Visit Info
        </h3>

        <div className="text-xs bg-base-200/40 p-3 rounded-lg border border-base-300/30 space-y-1">
          <p>
            <span className="font-semibold">Date:</span>{" "}
            {values.date ? (
              dateFormat(values.date)
            ) : (
              <span className="opacity-50">Not set</span>
            )}
          </p>
          <p>
            <span className="font-semibold">Time:</span>{" "}
            {values.start_time && values.end_time ? (
              <>
                {values.start_time} – {values.end_time}
              </>
            ) : (
              <span className="opacity-50">Not set</span>
            )}
          </p>
        </div>
      </section>

      {/* CLIENT DATA */}
      <section>
        <h3 className="text-sm font-semibold opacity-70 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-primary" />
          Client Info
        </h3>

        <div className="mt-2 text-xs bg-base-200/40 p-3 rounded-lg border border-base-300/30 space-y-1">
          <p>
            <span className="font-semibold">Client:</span>{" "}
            {clientName || <span className="opacity-50">Not selected</span>}
          </p>

          <p>
            <span className="font-semibold">Distributor:</span>{" "}
            {distributorName || (
              <span className="opacity-50">Not selected</span>
            )}
          </p>

          <p>
            <span className="font-semibold">Retailer:</span>{" "}
            {retailerName || <span className="opacity-50">Not selected</span>}
          </p>
        </div>
      </section>

      {/* PRODUCTS */}
      <section>
        <h3 className="text-sm font-semibold opacity-70 flex items-center gap-2">
          <CubeIcon className="w-4 h-4 text-primary" />
          Products
        </h3>

        {selectedProducts.length ? (
          <ul className="space-y-1 mt-2">
            {selectedProducts.map((name: string, index: number) => (
              <li
                key={index}
                className="text-xs bg-base-200/50 px-3 py-2 rounded-md border border-base-300/40"
              >
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs opacity-50 mt-2">None selected yet</p>
        )}
      </section>

      {/* LOCATION */}
      <section>
        <h3 className="text-sm font-semibold opacity-70 flex items-center gap-2">
          <MapPinIcon className="w-4 h-4 text-primary" />
          Location
        </h3>

        {values.latitude && values.longitude ? (
          <div className="mt-2 text-xs bg-base-200/40 p-3 rounded-lg border border-base-300/30 space-y-1">
            <p>
              <span className="font-semibold">Lat:</span> {values.latitude}
            </p>
            <p>
              <span className="font-semibold">Lng:</span> {values.longitude}
            </p>
          </div>
        ) : (
          <p className="text-xs opacity-50 mt-2">Not selected yet</p>
        )}
      </section>

      {/* STEP COMPLETION */}
      <section>
        <h3 className="text-sm font-semibold opacity-70">
          Form Status {progress.toFixed(0)}%
        </h3>

        <div className="w-full h-2 bg-base-300 rounded-full mt-2 overflow-hidden">
          <motion.div
            className={`h-full ${isComplete ? "bg-green-500" : "bg-primary"}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <ul className="mt-2 text-xs space-y-2">
          {steps.map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-2 border-b border-base-300/30 pb-1"
            >
              {s.done ? (
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
              )}

              <span className={s.done ? "text-green-600" : "opacity-70"}>
                {s.title}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* AUTOMATIC WARNINGS */}
      {warnings.length > 0 && (
        <section className="bg-yellow-100 text-yellow-700 text-xs p-3 rounded-lg border border-yellow-300 space-y-1">
          <h4 className="font-semibold flex items-center gap-1">
            <ExclamationTriangleIcon className="w-4 h-4" />
            Missing Information
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </motion.aside>
  );
}
