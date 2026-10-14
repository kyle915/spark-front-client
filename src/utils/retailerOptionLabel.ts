/** Picker label for a retailer account: a store roster has dozens of
 * "Shell"s, so regional stores carry their address. */
export function retailerOptionLabel(retailer: {
  name: string;
  address?: string | null;
}): string {
  const name = retailer.name.trim();
  const address = (retailer.address ?? "").trim();
  if (!address || name.toLowerCase().includes(address.toLowerCase())) return name;
  return `${name} · ${address}`;
}

/** Every typed word must appear in the store's name or address, so
 * "shell owensboro" narrows a roster to that town's Shells. */
export function retailerMatchesSearch(
  retailer: { name: string; address?: string | null },
  q: string,
): boolean {
  const hay = `${retailer.name} ${retailer.address ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}
