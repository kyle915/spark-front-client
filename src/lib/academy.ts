/**
 * Spark Academy — presentation helpers.
 *
 * Training modules (brand history, product deep-dives, activation
 * playbooks, compliance/policy docs) now live on the backend
 * `AcademyModule` model and are loaded via the `academyModulesAdmin`
 * and `academyModule` GraphQL queries. Admins create/edit/publish them
 * on /academy/manage (backed by the create/update/delete mutations).
 *
 * The backend `kind` is a free-form string, so the label/color helpers
 * below degrade gracefully for any value the backend returns.
 */

const KIND_LABELS: Record<string, string> = {
  brand: "Brand 101",
  product: "Product training",
  training: "Training",
  playbook: "Activation playbook",
  policy: "Policy",
  compliance: "Compliance",
  announcement: "Announcement",
};

const KIND_COLORS: Record<string, string> = {
  brand: "var(--spark-lime)",
  product: "var(--spark-sky)",
  training: "var(--spark-lime)",
  playbook: "var(--spark-purple)",
  policy: "var(--spark-orange)",
  compliance: "var(--spark-orange)",
  announcement: "var(--spark-sky)",
};

const titleCase = (s: string): string =>
  s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

export const kindLabel = (kind: string): string =>
  KIND_LABELS[kind?.toLowerCase()] ?? (kind ? titleCase(kind) : "Module");

export const kindColor = (kind: string): string =>
  KIND_COLORS[kind?.toLowerCase()] ?? "var(--spark-lime)";
