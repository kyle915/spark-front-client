interface DashboardHeaderProps {
  quarterLabel?: string | null;
  title: string;
}

const DashboardHeader = ({ quarterLabel, title }: DashboardHeaderProps) => {
  const readableRange = quarterLabel
    ? quarterLabel // en Spark no usamos getQuarterDateRangeLabel aún
    : "January - December 2025";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-center gap-4 text-center">
        <h1
          className="
              text-3xl md:text-4xl font-extrabold tracking-tight
              text-base-content 
              transition-colors duration-300
            "
        >
          {title}
        </h1>
      </div>

      {/* Subtitle */}
      <p className="font-medium text-center text-md md:text-lg mb-2 text-gray-600 dark:text-gray-400">
        {readableRange}
      </p>

      {/* Line */}
      <div className="w-40 h-1 bg-linear-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
    </div>
  );
};

export default DashboardHeader;
