import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { registerCheckinPwa } from "./registerCheckinPwa";

/**
 * Field-facing public app — /checkin, /spark-form, /r/:token, /training.
 *
 * Booted from main.tsx instead of App so aisle/LTE phones never download
 * Google GSI, Login, Layout, or the admin route table. These pages talk
 * REST / the public GraphQL client; they do not need Relay or SSO.
 */

const SparkCheckin = lazy(() => import("@/components/pages/checkin/SparkCheckin"));
const SparkPublicExpressForm = lazy(
  () => import("@/public/form/SparkPublicExpressForm"),
);
const PublicRecap = lazy(() => import("@/public/recaps/PublicRecap"));
const TrainingHub = lazy(() => import("@/public/training/TrainingHub"));
const PublicJobBoard = lazy(() => import("@/public/jobs/PublicJobBoard"));

const Fallback = () => (
  <div
    className="min-h-[100dvh] flex items-start justify-center"
    style={{ background: "#faf7f1", color: "#78716c", padding: "48px 20px" }}
  >
    <p className="text-sm">Loading…</p>
  </div>
);

export default function PublicFieldApp() {
  useEffect(() => {
    registerCheckinPwa();
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/checkin/:code" element={<SparkCheckin />} />
          <Route path="/spark-form/:tenantSlug" element={<SparkPublicExpressForm />} />
          <Route path="/r/:token" element={<PublicRecap />} />
          <Route path="/training/:code" element={<TrainingHub />} />
          <Route path="/jobs/:token" element={<PublicJobBoard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
