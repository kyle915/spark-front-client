import type { RecapQuickPeekItem } from "@/recap/RecapQuickPeekSheet";

const PIN_STORAGE_PREFIX = "@spark.clientProof.pinnedUrls.v1/";

export function loadLocalPinnedUrls(
  tenantId: string,
  storage: Pick<Storage, "getItem"> | null | undefined = typeof localStorage !==
  "undefined"
    ? localStorage
    : null,
): Set<string> {
  if (!storage || !tenantId) return new Set();
  try {
    const raw = storage.getItem(`${PIN_STORAGE_PREFIX}${tenantId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function saveLocalPinnedUrls(
  tenantId: string,
  urls: ReadonlySet<string>,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof localStorage !==
  "undefined"
    ? localStorage
    : null,
): void {
  if (!storage || !tenantId) return;
  try {
    storage.setItem(
      `${PIN_STORAGE_PREFIX}${tenantId}`,
      JSON.stringify([...urls]),
    );
  } catch {
    // Ignore private-mode storage quota errors.
  }
}

export interface ProofRecapMetrics {
  id?: string | null;
  name?: string | null;
  approved?: boolean | null;
  totalEngagements?: number | null;
  consumersSampled?: number | null;
  soldUnits?: number | null;
  customRecapFilesCount?: number | null;
  shareToken?: string | null;
  sharedAt?: string | null;
}

export function buildClientProofQuickPeekItem(
  frame: {
    recapId: string;
    uuid: string;
    url: string;
    retailerName: string;
    stateCode: string | null;
    rawDate: string;
    fileCount: number;
  },
  metrics?: ProofRecapMetrics | null,
): RecapQuickPeekItem {
  const sampled = metrics?.consumersSampled ?? null;
  const engaged = metrics?.totalEngagements ?? sampled;
  return {
    kind: "custom",
    id: metrics?.id || frame.recapId,
    uuid: frame.uuid,
    name: metrics?.name || frame.retailerName || "Field activation",
    date: frame.rawDate,
    retailerName: frame.retailerName || "—",
    stateCode: frame.stateCode,
    approved: metrics?.approved ?? true,
    approvalMeta: "Approved recap",
    heroImage: frame.url,
    fileCount: Math.max(frame.fileCount, metrics?.customRecapFilesCount ?? 1),
    engagements: engaged,
    consumersSampled: sampled,
    productsSold: metrics?.soldUnits ?? null,
    isDryDemo: false,
    peopleEngaged: engaged,
    cansSold: null,
    packsSold: null,
    accountSpendAmount: null,
    baName: "",
    isExternalBa: false,
    isThirdParty: false,
    excludeFromAggregates: false,
    sourceLabel: "",
    recapType: "retail",
    requestUuid: null,
    requestShortId: null,
    shareToken: metrics?.shareToken ?? null,
    sharedAt: metrics?.sharedAt ?? null,
    archivedAt: null,
  };
}
