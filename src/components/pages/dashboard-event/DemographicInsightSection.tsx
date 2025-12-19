import { UserStar } from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import type { ChartOptions } from "chart.js";
import { Pie } from "react-chartjs-2";
import { memo, useMemo } from "react";
import { useThemeMode } from "@/hooks/useThemeMode";
import ChartCard from "@/components/charts/ChartCard";

ChartJS.register(ArcElement, Tooltip, Legend);

export default memo(function DemographicInsightSection({
  ageDistribution,
  genderDistribution,
}: {
  ageDistribution: { label: string; value: number; consumers?: number }[];
  genderDistribution: { label: string; value: number }[];
}) {
  const [isDark] = useThemeMode();

  const { textColor, labelColor, borderColor } = useMemo(() => {
    return {
      textColor: isDark ? "#e5e7eb" : "#1f2937", // gray-200 / gray-800
      labelColor: isDark ? "#cbd5e1" : "#475569", // slate-300 / slate-600
      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    };
  }, [isDark]);

  // PIE CHART SETUP
  const pieData = {
    labels: genderDistribution.map((g) => g.label),
    datasets: [
      {
        label: "Gender",
        data: genderDistribution.map((g) => g.value),
        backgroundColor: ["rgba(59, 130, 246, 0.8)", "rgba(111, 49, 255, 0.8)"],
        borderWidth: 2,
        borderColor: borderColor,
      },
    ],
  };

  const pieOptions: ChartOptions<"pie"> = {
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: textColor,
          padding: 16,
          font: { size: 14 },
        },
      },
      tooltip: {
        backgroundColor: isDark ? "#1e293b" : "#ffffff",
        titleColor: textColor,
        bodyColor: textColor,
        borderColor,
        borderWidth: 1,
      },
    },
  };

  return (
    <ChartCard
      title="Consumer Demographics"
      icon={UserStar}
      iconColor="text-purple-600"
      fixedHeight={true}
    >
      <div className="grid grid-cols-2 xl:grid-cols-2 gap-6 mt-10">
        <div className="w-[260px] sm:w-[300px] md:w-[350px]">
          <Pie data={pieData} options={pieOptions} />
        </div>

        <div>
          <h1 className="text-xl font-bold mb-2 flex items-center justify-center gap-2">
            <span className="text-xl font-bold">Age Distribution</span>
          </h1>
          {ageDistribution.map((age) => (
            <div key={age.label} className="flex flex-col gap-1">
              {/* top row */}
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{age.label}</span>
                <span className="font-semibold">{age.value}%</span>
              </div>

              {/* progress bar */}
              <div className="w-full h-2 rounded-full bg-base-300 overflow-hidden">
                <div
                  style={{ width: `${age.value}%` }}
                  className="h-full rounded-full bg-primary"
                />
              </div>

              {/* consumers number */}
              <span className="text-xs mt-1" style={{ color: labelColor }}>
                {age.consumers?.toLocaleString() ?? "0"} consumers
              </span>

              {/* divider */}
              <div className="w-full border-b mt-2" style={{ borderColor }} />
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
});
