import type { ChartData, LimitSample, Plan } from "#/domain/model";
import chartJson from "./chart-benchmarks.json";
import plansJson from "./plans.json";
import samplesJson from "./samples.json";

// SAFETY: scripts/ write these files through their zod schemas, and
// data.test.ts checks each committed copy is exactly what its schema outputs,
// so the page trusts them instead of parsing ~240 KB of JSON on every load.
// JSON imports type enums as plain strings, hence the step through unknown.
const chart = chartJson as unknown as ChartData;
export const { frontier, leaderboards } = chart;
export const plans = plansJson as Plan[];
export const samples = samplesJson as LimitSample[];
