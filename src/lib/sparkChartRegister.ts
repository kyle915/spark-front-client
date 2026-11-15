import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

/**
 * The Chart.js pieces a Spark chart can use: bars and lines on a category
 * axis with one linear value scale. Both controllers are registered because
 * react-chartjs-2's generic <Chart> does not register them itself. No arc
 * element: Spark does not draw pies or doughnuts.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
);
