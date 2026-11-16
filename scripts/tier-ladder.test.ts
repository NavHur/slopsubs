import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "../src/domain/model.ts";
import { type KnownTier, scaledCap } from "./tier-ladder.ts";

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
