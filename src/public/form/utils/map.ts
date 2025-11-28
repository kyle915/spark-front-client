export function mapQuery<T>(edges?: ReadonlyArray<{ node: T }> | null): T[] {
  return edges?.map((e) => e.node) ?? [];
}
