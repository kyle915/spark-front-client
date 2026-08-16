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
import type { SparkFormData } from "../schema/schema";

interface SideSummaryProps {
  values: SparkFormData;
  progress: number;
  timeZones: {
    id: string;
    name: string;
    code: string;
    offset: number;
  }[];
  productsFull: {
    id: string;
    name: string;
  }[];
}

export default function SideSummary({
  values,
  progress,
  productsFull,
  timeZones,
}: SideSummaryProps) {
  const isComplete = progress >= 100;

  // PRODUCT NAMES SELECTED
  const selectedProducts = (values.skus || []).map((id) => {
    const found = productsFull.find((p) => p.id === id);
    return found ? found.name : id;
  });

  const timeZoneName = timeZones.find(
    (tz) => tz.id === values.timeZoneId,
  )?.name;

  // STEP STATUS
  const steps = [
    {
      title: "Basic Information",
      done:
        Boolean(values.name) &&
        Boolean(values.date) &&
        Boolean(values.start_time) &&
        Boolean(values.end_time) &&
        Boolean(values.latitude) &&
        Boolean(values.longitude) &&
        Boolean(values.address) &&
        Boolean(values.timeZoneId),
    },
    {
      title: "Products",
      done: Array.isArray(values.skus) && values.skus.length > 0,
    },
    {
      title: "Client Details",
      done:
        Boolean(values.distributor) &&
        Boolean(values.distributorEmail) &&
        Boolean(values.retailer) &&
        Boolean(values.retailerAddress) &&
        Boolean(values.retailerStoreContact) &&
        Boolean(values.storeManagerName) &&
        Boolean(values.storeManagerContact) &&
        Boolean(values.request_type),
    },
  ];
  const blocker = !steps[0].done
    ? "Venue"
    : !steps[1].done
      ? "Products"
      : !steps[2].done
        ? "Client"
        : null;

  // WARNINGS
  const warnings: string[] = [];

  if (!values.skus?.length) warnings.push("No products selected.");
  if (!values.latitude || !values.longitude)
    warnings.push("Select a location on the map.");
  if (!values.date) warnings.push("Visit date is missing.");
  if (!values.distributor) warnings.push("Distributor is missing.");
  if (!values.request_type) warnings.push("Request type is required.");

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden sm:block w-full md:w-80 p-4 sm:p-6 rounded-2xl bg-base-100/80 backdrop-blur-xl shadow-lg border border-base-300/40 md:sticky md:top-4 space-y-6 sm:space-y-8"
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

      {/* DATE + TIME */}
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
          <p>
            <span className="font-semibold">Time Zone:</span>{" "}
            {values.timeZoneId ? (
              timeZoneName
            ) : (
              <span className="opacity-50">Not set</span>
            )}
          </p>
        </div>
      </section>

      {/* CLIENT / DISTRIBUTOR / RETAILER */}
      <section>
        <h3 className="text-sm font-semibold opacity-70 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-primary" />
          Distributor | Retailer Details
        </h3>

        <div className="mt-2 text-xs bg-base-200/40 p-3 rounded-lg border border-base-300/30 space-y-1">
          <p>
            <span className="font-semibold">Distributor:</span>{" "}
            {values.distributor || (
              <span className="opacity-50">Not entered</span>
            )}
          </p>

          <p>
            <span className="font-semibold">Distributor Email:</span>{" "}
            {values.distributorEmail || (
              <span className="opacity-50">Not entered</span>
            )}
          </p>

          <p>
            <span className="font-semibold">Retailer:</span>{" "}
            {values.retailer || (
              <span className="opacity-50">Not selected</span>
            )}
          </p>

          <p>
            <span className="font-semibold">Retailer Address:</span>{" "}
            {values.retailerAddress || (
              <span className="opacity-50">Not entered</span>
            )}
          </p>

          <p>
            <span className="font-semibold">Store Contact:</span>{" "}
            {values.retailerStoreContact || (
              <span className="opacity-50">Not entered</span>
            )}
          </p>

          <p>
            <span className="font-semibold">Manager Name:</span>{" "}
            {values.storeManagerName || (
              <span className="opacity-50">Not entered</span>
            )}
          </p>

          <p>
            <span className="font-semibold">Manager Contact:</span>{" "}
            {values.storeManagerContact || (
              <span className="opacity-50">Not entered</span>
            )}
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
            {selectedProducts.map((name) => (
              <li
                key={name}
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

      {/* FORM STATUS */}
      <section>
        <h3 className="text-sm font-semibold opacity-70">
          Form Status {progress.toFixed(0)}%
          {blocker ? ` · Needs ${blocker}` : ""}
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

      {/* WARNINGS */}
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
