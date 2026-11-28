export interface SparklineGeometry {
  linePath: string;
  areaPath: string;
  lastPoint: { x: number; y: number } | null;
}

export function buildSparklinePath(
  values: readonly number[],
  width = 64,
  height = 22,
  pad = 2,
): SparklineGeometry {
  const clean = values.filter((n) => Number.isFinite(n));
  if (clean.length < 2 || width <= pad * 2 || height <= pad * 2) {
    return { linePath: "", areaPath: "", lastPoint: null };
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const pts = clean.map((v, idx) => {
    const x = pad + (idx / (clean.length - 1)) * innerW;
    const norm = span === 0 ? 0.5 : (v - min) / span;
    const y = pad + (1 - norm) * innerH;
    return {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  const baseline = height - pad;
  const areaPath = `${linePath} L${last.x},${baseline} L${first.x},${baseline} Z`;

  return {
    linePath,
    areaPath,
    lastPoint: last,
  };
}
