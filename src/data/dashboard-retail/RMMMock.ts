export interface RmmPerformanceItem {
  rmm: string;
  consumers: number;
  demos: number;
  conversion: number; // %
}

export const mockRmmPerformance: RmmPerformanceItem[] = [
  { rmm: "Miguel T.", consumers: 5700, demos: 120, conversion: 22 },
  { rmm: "Priya P.", consumers: 2600, demos: 80, conversion: 16 },
  { rmm: "Isabella R.", consumers: 2150, demos: 95, conversion: 27 },
  { rmm: "Carlos R.", consumers: 1850, demos: 110, conversion: 28 },
  { rmm: "Jamal R.", consumers: 1700, demos: 75, conversion: 20 },
  { rmm: "Samantha L.", consumers: 1550, demos: 68, conversion: 17 },
  { rmm: "Emily C.", consumers: 1450, demos: 60, conversion: 19 },
];
