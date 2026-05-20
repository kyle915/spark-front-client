/**
 * Spark Academy — localStorage-backed knowledge base for BAs.
 *
 * Each tenant has a set of training modules: brand history, product
 * deep-dives, activation playbooks, compliance docs. Admins create
 * them; BAs read them; job postings link to required modules so a BA
 * has to complete the brief before clocking in.
 *
 * Persistence: localStorage v1 (per-tenant). When the backend Academy
 * model ships (BACKEND-PATCH.md addendum) the writes swap to mutations.
 */

export type AcademyKind = "brand" | "product" | "playbook" | "compliance";

export type AcademyAttachment = {
  id: string;
  name: string;
  url: string;
  kind: "pdf" | "video" | "link" | "image";
};

export type AcademyModule = {
  id: string;
  title: string;
  kind: AcademyKind;
  brand: string;
  summary: string;
  body: string; // markdown / plain text
  attachments: AcademyAttachment[];
  estMinutes: number;
  requiredFor: string[]; // job uuids that require this
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

const KEY = (tenantId: string) => `@spark.academy/${tenantId}`;

export const KIND_LABEL: Record<AcademyKind, string> = {
  brand: "Brand 101",
  product: "Product training",
  playbook: "Activation playbook",
  compliance: "Compliance",
};

export const KIND_COLOR: Record<AcademyKind, string> = {
  brand: "var(--spark-lime)",
  product: "var(--spark-sky)",
  playbook: "var(--spark-purple)",
  compliance: "var(--spark-orange)",
};

export const loadModules = (tenantId: string): AcademyModule[] => {
  try {
    const raw = localStorage.getItem(KEY(tenantId));
    return raw ? (JSON.parse(raw) as AcademyModule[]) : [];
  } catch {
    return [];
  }
};

export const saveModules = (tenantId: string, modules: AcademyModule[]) => {
  try {
    localStorage.setItem(KEY(tenantId), JSON.stringify(modules));
  } catch {
    /* quota or private mode — ignore */
  }
};

export const newModule = (brand: string): AcademyModule => ({
  id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  title: "Untitled module",
  kind: "brand",
  brand,
  summary: "",
  body: "",
  attachments: [],
  estMinutes: 5,
  requiredFor: [],
  published: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
