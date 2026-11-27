export const ASK_SPARK_EVENT = "spark:open-ask-spark";

export interface OpenAskSparkDetail {
  question?: string;
  tenantId?: string;
  mode?: "data" | "help";
}

export function dispatchOpenAskSpark(detail: OpenAskSparkDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenAskSparkDetail>(ASK_SPARK_EVENT, { detail }),
  );
}
