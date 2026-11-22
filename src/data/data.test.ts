import { Schema } from "effect";
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
		expect(Schema.decodeUnknownSync(schema)(json)).toEqual(json);
	});
});

describe("dataset validation", () => {
	const mark = {
		plan: "claude-max-20x",
		from: "2026-02-27T09:00:00Z",
		to: "2026-02-27T10:00:00Z",
		startUsedPercent: 10,
		endUsedPercent: 20,
		apiUsd: 3,
		apiUsdByFamily: {},
		host: "test",
	};

	it("rejects an impossible calendar date", () => {
		const decode = Schema.decodeUnknownSync(LimitSamples);
		expect(() => decode([{ ...mark, from: "2026-02-30T09:00:00Z" }])).toThrow(
			/calendar date/,
		);
	});

	it("rejects a sample whose weekly gauge does not rise", () => {
		const decode = Schema.decodeUnknownSync(LimitSamples);
		expect(() =>
			decode([{ ...mark, startUsedPercent: mark.endUsedPercent }]),
		).toThrow(/endUsedPercent must exceed startUsedPercent/);
	});

	it("rejects a reported cap with a blank family key instead of dropping it", () => {
		const plan = {
			...plansJson[0],
			reportedCap: {
				weeklyCapApiUsdByFamily: { "": 20, valid: 30 },
				by: "test",
				url: "https://example.com/",
				basis: "test",
			},
		};
		expect(() => Schema.decodeUnknownSync(Plans)([plan])).toThrow(
			/length of at least 1/,
		);
	});
});
