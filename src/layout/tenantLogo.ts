/**
 * Tenant picker logos.
 *
 * Prefer the API `image` field when it is a usable avatar. Some tenants
 * have an image that is a wide black wordmark (Liquid Death) — it loads
 * but disappears at 20×20 on the dark sidebar. Those fall through to an
 * official mark.
 *
 * Official fallbacks are hotlinked from the brand / Wikimedia / the
 * brand's own CDN. We do not invent trademarks. Initials are last resort.
 */

export type TenantLogoInput = {
  name?: string | null;
  requestUrlName?: string | null;
  tenantSlug?: string | null;
  image?: string | null;
};

/** API images that exist but do not read as a 20px mark on a dark chip. */
const UNUSABLE_API_IMAGE_MARKERS = [
  // Liquid Death wordmark: 1200×305, fill #151515 — invisible at 20px.
  "1768336651834_logo.svg",
];

/**
 * Official marks keyed by a normalized name/slug.
 * Sources are documented next to each URL.
 */
const OFFICIAL_FALLBACKS: Record<string, string> = {
  // Wikimedia Commons, official Liquid Death mark (skull, not the wordmark).
  // https://commons.wikimedia.org/wiki/File:Liquid-Death-Logo.svg
  liquiddeath: "https://upload.wikimedia.org/wikipedia/commons/9/94/Liquid-Death-Logo.svg",
  ighnliquiddeath: "https://upload.wikimedia.org/wikipedia/commons/9/94/Liquid-Death-Logo.svg",

  // Official Neutonic Shopify logo.
  neutonic: "https://www.neutonic.com/cdn/shop/files/new-logo_51b5ec78-3216-4f70-af54-3e89f1c5bc53.png?v=1711439633&width=400",

  // Official Stone House Bread WordPress header logo.
  stonehousebread: "https://stonehousebread.com/wp-content/uploads/2019/11/new-logo2.png",

  // Wikimedia Commons, sourced from Total Wireless.
  // https://commons.wikimedia.org/wiki/File:Total_Wireless_logo.png
  totalwireless: "https://upload.wikimedia.org/wikipedia/commons/0/04/Total_Wireless_logo.png",

  // Official Torch Hemp storefront logo (matches keee-torch-thc).
  torchthc: "https://torchhemp.com/cdn/shop/files/TorchLogoNEWprint-site_650x.png?v=1724781409",
  keeetorchthc: "https://torchhemp.com/cdn/shop/files/TorchLogoNEWprint-site_650x.png?v=1724781409",
  torch: "https://torchhemp.com/cdn/shop/files/TorchLogoNEWprint-site_650x.png?v=1724781409",

  // Official Sipli Squarespace header logo.
  sipli: "https://images.squarespace-cdn.com/content/v1/67d9b1bea143a330e362fb5d/0b8289b0-e6d3-499b-8e89-c43326f1feaf/Sipli_logo.png?format=500w",

  // Wikimedia Commons, sourced from brewdrkombucha.com.
  // https://commons.wikimedia.org/wiki/File:Brew_Dr._Kombucha_logo.png
  brewdrkombucha: "https://upload.wikimedia.org/wikipedia/commons/4/47/Brew_Dr._Kombucha_logo.png",
  brewdr: "https://upload.wikimedia.org/wikipedia/commons/4/47/Brew_Dr._Kombucha_logo.png",

  // Wikimedia Commons, sourced from dudeproducts.com.
  // https://commons.wikimedia.org/wiki/File:Dude_Wipes_logo.svg
  dudewipes: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Dude_Wipes_logo.svg",
};

export function normalizeTenantKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function keysFor(input: TenantLogoInput): string[] {
  const raw = [input.name, input.requestUrlName, input.tenantSlug].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  const keys = new Set<string>();
  for (const value of raw) {
    const key = normalizeTenantKey(value);
    if (!key) continue;
    keys.add(key);
    if (key.startsWith("ighn") && key.length > 4) keys.add(key.slice(4));
    if (key.startsWith("keee") && key.length > 4) keys.add(key.slice(4));
  }
  return [...keys];
}

export function isUsableApiImage(image: string | null | undefined): boolean {
  const url = image?.trim() ?? "";
  if (!url) return false;
  return !UNUSABLE_API_IMAGE_MARKERS.some((marker) => url.includes(marker));
}

export function officialFallbackSrc(input: TenantLogoInput): string | null {
  for (const key of keysFor(input)) {
    const src = OFFICIAL_FALLBACKS[key];
    if (src) return src;
  }
  return null;
}

/** Ordered sources to try: usable API image, then official fallback. */
export function tenantLogoCandidates(input: TenantLogoInput): string[] {
  const out: string[] = [];
  const api = input.image?.trim() ?? "";
  if (isUsableApiImage(api)) out.push(api);
  const fallback = officialFallbackSrc(input);
  if (fallback && !out.includes(fallback)) out.push(fallback);
  return out;
}

export function tenantInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "—";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
