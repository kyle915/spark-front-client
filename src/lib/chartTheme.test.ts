import { describe, expect, it } from "vitest";
import {
  sparkChartGrid,
  sparkChartMuted,
  sparkChartOptions,
  sparkChartText,
} from "./chartTheme";

describe("sparkChartOptions", () => {
  it("keeps dual-axis geometry and layers quiet chrome underneath", () => {
    const options = sparkChartOptions<"bar" | "line">({
      scales: {
        y1: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: { display: true, text: "Engagements / Samples" },
        },
        y2: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          min: 0,
          max: 100,
          ticks: { precision: 0, callback: (v) => `${v}%` },
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Recaps" },
        },
        x: {
          ticks: { maxRotation: 45, minRotation: 45 },
        },
      },
    });

    expect(options.plugins?.legend?.labels).toMatchObject({
      color: sparkChartText,
      usePointStyle: true,
      boxWidth: 10,
    });
    expect(options.plugins?.tooltip).toMatchObject({
      backgroundColor: "rgba(10,13,9,0.92)",
      titleColor: sparkChartText,
      bodyColor: sparkChartMuted,
      borderColor: "rgba(197,245,70,0.25)",
      borderWidth: 1,
    });

    const y1 = options.scales?.y1;
    const y2 = options.scales?.y2;
    const x = options.scales?.x;
    expect(y1).toMatchObject({
      type: "linear",
      position: "left",
      beginAtZero: true,
      ticks: { color: sparkChartMuted, font: { size: 11 } },
      grid: { color: sparkChartGrid },
      border: { color: "transparent" },
      title: {
        display: true,
        text: "Engagements / Samples",
        color: sparkChartText,
        font: { size: 11 },
      },
    });
    expect(y2).toMatchObject({
      position: "right",
      min: 0,
      max: 100,
      grid: { color: sparkChartGrid, drawOnChartArea: false },
      title: { text: "Recaps", color: sparkChartText },
    });
    expect(y2?.ticks).toMatchObject({ color: sparkChartMuted, precision: 0 });
    expect(x?.ticks).toMatchObject({
      color: sparkChartMuted,
      maxRotation: 45,
      minRotation: 45,
    });
    expect(x?.grid).toMatchObject({ color: sparkChartGrid });
  });
});
