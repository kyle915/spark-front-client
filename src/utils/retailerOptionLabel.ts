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
