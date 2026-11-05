import { describe, expect, it } from "vite-plus/test";
import { ChartData, LimitSamples, Plans } from "#/domain/model";
import chartJson from "./chart-benchmarks.json";
import plansJson from "./plans.json";
import samplesJson from "./samples.json";

// The client trusts these files without parsing, so each must already equal
// its schema's output; this catches hand edits the scripts did not make.
describe("shipped data", () => {
	it.each([
		["chart-benchmarks.json", ChartData, chartJson],
		["plans.json", Plans, plansJson],
		["samples.json", LimitSamples, samplesJson],
	] as const)("%s is what its schema outputs", (_file, schema, json) => {
		expect(schema.parse(json)).toEqual(json);
	});
});
