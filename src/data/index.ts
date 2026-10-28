import { ChartData, LimitSamples, Plans } from "#/domain/model";
import chartJson from "./chart-benchmarks.json";
import plansJson from "./plans.json";
import samplesJson from "./samples.json";

export const { frontier, leaderboards } = ChartData.parse(chartJson);
export const plans = Plans.parse(plansJson);
export const samples = LimitSamples.parse(samplesJson);
