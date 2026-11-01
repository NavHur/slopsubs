import { describe, expect, it } from "vite-plus/test";
import { ChartData, LimitSamples, Plans } from "#/domain/model";
import chartJson from "./chart-benchmarks.json";
import plansJson from "./plans.json";
import samplesJson from "./samples.json";

// The client imports these files without parsing them, so each must already
// be exactly what its schema outputs: valid, with nothing parsing would strip
// or change. The import scripts write them that way; this catches hand edits.
describe("shipped data", () => {
	it.each([
		["chart-benchmarks.json", ChartData, chartJson],
		["plans.json", Plans, plansJson],
		["samples.json", LimitSamples, samplesJson],
	] as const)("%s is what its schema outputs", (_file, schema, json) => {
		expect(schema.parse(json)).toEqual(json);
	});
});
