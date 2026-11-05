import type { ChartData, LimitSample, Plan } from "#/domain/model";
import chartJson from "./chart-benchmarks.json";
import plansJson from "./plans.json";
import samplesJson from "./samples.json";

// SAFETY: data.test.ts pins each file to its schema's output (see README), so
// the page skips parsing; the step through unknown is for JSON-widened enums.
const chart = chartJson as unknown as ChartData;
export const { frontier, leaderboards } = chart;
export const plans = plansJson as Plan[];
export const samples = samplesJson as LimitSample[];
