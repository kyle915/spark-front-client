export type StoreMapSuggestion = {
  uuid?: string;
  name?: string;
  address?: string;
  kind?: string;
  isNational?: boolean;
  score?: number;
  confidence?: string;
  reason?: string;
  source?: string;
};

export type StoreMapConfidence = "high" | "medium" | "low";

export function asSuggestions(raw: unknown): StoreMapSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is StoreMapSuggestion =>
    Boolean(row && typeof row === "object"),
  );
}

export function confidenceOf(hit: StoreMapSuggestion): StoreMapConfidence {
  const c = (hit.confidence || "").toLowerCase();
  if (c === "high" || c === "medium" || c === "low") return c;
  const score = Number(hit.score || 0);
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

export function confidenceLabel(level: StoreMapConfidence): string {
  if (level === "high") return "High confidence";
  if (level === "medium") return "Medium confidence";
  return "Low confidence";
}

export function needsAiRefresh(hits: StoreMapSuggestion[]): boolean {
  if (hits.length === 0) return true;
  return confidenceOf(hits[0]) !== "high";
}
