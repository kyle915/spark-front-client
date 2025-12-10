export interface ReachConversionItem {
  market: string;
  consumers: number;
  conversion: number;
}

export const mockReachConversion: ReachConversionItem[] = [
  { market: "Los Angeles, CA", consumers: 2300, conversion: 18 },
  { market: "Florida, FL", consumers: 1600, conversion: 21 },
  { market: "Dallas, TX", consumers: 1100, conversion: 10 },
  { market: "San Diego, CA", consumers: 1050, conversion: 13 },
  { market: "New York City, NY", consumers: 980, conversion: 15 },
  { market: "Houston, TX", consumers: 950, conversion: 12 },
  { market: "Las Vegas, NV", consumers: 780, conversion: 10 },
  { market: "Portland, OR", consumers: 850, conversion: 18 },
  { market: "Seattle, WA", consumers: 2300, conversion: 32 },
  { market: "Salt Lake City, UT", consumers: 690, conversion: 12 },
  { market: "Denver, CO", consumers: 720, conversion: 15 },
  { market: "Chicago, IL", consumers: 1200, conversion: 20 },
  { market: "Boston, MA", consumers: 710, conversion: 11 },
  { market: "Phoenix, AZ", consumers: 1000, conversion: 19 },
  { market: "Miami, FL", consumers: 700, conversion: 16 },
];
