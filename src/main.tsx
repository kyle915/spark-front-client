import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { isPublicFieldPath } from "@/utils/publicHosts";

// leaflet.css / Chart.js stay out of this file — see the previous
// comments. The split below is the one that keeps aisle/LTE check-in
// and recap share from downloading Google GSI + the admin shell.

async function mount() {
  const Root = isPublicFieldPath(window.location.pathname)
    ? (await import("./public/PublicFieldApp")).default
    : (await import("./App")).default;

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

void mount();
