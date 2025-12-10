export function AiInsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-6 w-full"></div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full"></div>
        ))}
      </div>
    </div>
  );
}
