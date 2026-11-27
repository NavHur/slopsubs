import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "../src/domain/model.ts";
import {
	type KnownTier,
	ladderCap as ladderCapEffect,
	scaledCap as scaledCapEffect,
} from "./tier-ladder.ts";

const scaledCap = (...args: Parameters<typeof scaledCapEffect>) =>
	Effect.runSync(scaledCapEffect(...args));
const ladderCap = <L extends string>(
	...args: Parameters<typeof ladderCapEffect<L>>
) => Effect.runSync(ladderCapEffect(...args));

const grok = "grok-4-7" as FamilyId;

const known: KnownTier = {
	label: "Ultra",
	base: "Plus",
	times: 50,
	cap: {
		weeklyCapApiUsdByFamily: { "grok-4-7": 1000 },
		by: "Someone",
		url: "https://example.com/report",
		basis: "Someone measured Ultra",
	},
};

describe("scaledCap", () => {
	it("gives a sibling tier the known cap times its multiple over the known one", () => {
		const premium = scaledCap(known, { label: "Premium", times: 4 }, [
			"grok-4-7",
		]);
		expect(premium.weeklyCapApiUsdByFamily[grok]).toBe(80);
		expect(premium.basis).toBe(
			"Someone measured Ultra, scaled from Ultra's 50x Plus to Premium's 4x Plus",
		);
		expect(premium.url).toBe(known.cap.url);
	});

	it("keeps the known tier's own figures and basis", () => {
		expect(
			scaledCap(known, { label: "Ultra", times: 50 }, ["grok-4-7"]),
		).toEqual(known.cap);
	});

	it("refuses a model the known tier has no figure for", () => {
		expect(() =>
			scaledCap(known, { label: "Plus", times: 1 }, ["grok-4-6"]),
		).toThrow(/Plus: no Ultra figure for grok-4-6/);
	});
});

describe("ladderCap", () => {
	const ladders = { "x-subscription": known };

	it("scales from the ladder's known tier", () => {
		const premium = { ladder: "x-subscription", times: 4 };
		expect(
			ladderCap(ladders, premium, "Premium", ["grok-4-7"])
				?.weeklyCapApiUsdByFamily[grok],
		).toBe(80);
	});

	it("has no cap for a ladder with no known tier, so the plan is unmeasured", () => {
		const go = { ladder: "minimax-m", times: 1 };
		expect(ladderCap(ladders, go, "Go", ["minimax-m3-1-flash"])).toBeNull();
	});

	it("has no cap for a plan on no ladder", () => {
		expect(ladderCap(ladders, undefined, "Solo", ["grok-4-7"])).toBeNull();
	});
});
