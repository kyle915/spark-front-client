import { MarketTable, type MarketData } from "./MarketTable";
import { MarketInsightsList, type InsightItem } from "./MarketInsightsList";

interface Props {
  marketTable: MarketData[];
  insights?: InsightItem[];
}

export function MarketInsightSection({ marketTable, insights }: Props) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-10 items-start">
        <div className="col-span-1 lg:col-span-2">
          <MarketTable data={marketTable} />
        </div>
        <div className="col-span-1 h-full">
          <MarketInsightsList data={insights ?? []} />
        </div>
      </div>
    </div>
  );
}
