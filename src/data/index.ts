import { BenchmarkDataset, LimitSamples, Plans } from "#/domain/model";
import benchmarksJson from "./chart-benchmarks.json";
import plansJson from "./plans.json";
import samplesJson from "./samples.json";

export const benchmarks = BenchmarkDataset.parse(benchmarksJson);
export const plans = Plans.parse(plansJson);
export const samples = LimitSamples.parse(samplesJson);
