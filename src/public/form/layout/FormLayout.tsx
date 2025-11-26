import ThemeToggle from "@/shared/ThemeToggle";

export default function SparkFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* NAVBAR */}
      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-20">
        <div className="flex-1">
          <h1 className="font-bold text-lg">Spark Request Form</h1>
        </div>

        <div className="flex-none">
          <ThemeToggle />
        </div>
      </div>

      {/* BODY */}
      <div className="p-6 flex flex-col items-center flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
