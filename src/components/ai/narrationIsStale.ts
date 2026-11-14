/** A summary of a week that ended more than `days` ago is old news. */
export function narrationIsStale(weekEnd: string, now: Date, days = 14): boolean {
  const end = new Date(`${weekEnd}T12:00:00`).getTime();
  if (!Number.isFinite(end)) return true;
  return now.getTime() - end > days * 86_400_000;
}
