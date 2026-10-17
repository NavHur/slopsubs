import { describe, expect, it } from "vitest";
import type { BenchmarkPoint, FamilyId } from "./model";
import { claudeMessageUsd, priceFor, UnpricedModelError } from "./pricing";

// SAFETY: priceFor reads only family and the two token prices.
const opus = {
	family: "claude-opus-5-5" as FamilyId,
	inputPricePerMTokUsd: 5,
	outputPricePerMTokUsd: 25,
} as BenchmarkPoint;

describe("priceFor", () => {
	it("resolves dated snapshots to their family", () => {
		expect(priceFor("claude-opus-5-5-20261001", [opus])).toEqual({
			inputPerMTokUsd: 5,
			outputPerMTokUsd: 25,
		});
	});

	it("refuses models it cannot price", () => {
		expect(() => priceFor("mystery-model", [opus])).toThrow(UnpricedModelError);
	});
});

describe("claudeMessageUsd", () => {
	it("prices cache reads and both cache-write lifetimes", () => {
		const usd = claudeMessageUsd(
			{
				input_tokens: 1_000_000,
				output_tokens: 1_000_000,
				cache_read_input_tokens: 1_000_000,
				cache_creation_input_tokens: 3_000_000,
				cache_creation: { ephemeral_1h_input_tokens: 1_000_000 },
			},
			{ inputPerMTokUsd: 5, outputPerMTokUsd: 25 },
		);
		// input 5 + read 0.5 + 5m write 2M*6.25 + 1h write 10 + output 25
		expect(usd).toBeCloseTo(5 + 0.5 + 12.5 + 10 + 25);
	});
});
