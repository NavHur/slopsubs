import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "../src/domain/model.ts";
import type { TokenRates } from "./list-price.ts";
import {
	WEEKLY_CREDIT_PLANS,
	type WeeklyCreditPlan,
	weeklyCreditCap,
} from "./weekly-credit-caps.ts";

const glm = "glm-5-3" as FamilyId;
const list: TokenRates = [1.4, 4.4];
const listRates = () => list;

describe("weeklyCreditCap", () => {
	const plan: WeeklyCreditPlan = {
		weeklyCredits: 10_000,
		rates: { [glm]: [690, 2400] },
		by: "Z.ai",
		url: "https://example.com/docs",
		basis: "credits",
	};

	it("prices the tokens the weekly credits buy at list, blended 3:1", () => {
		const cap = weeklyCreditCap(plan, [glm], listRates);
		// 10,000 credits buy 10,000 / 1,117.5 MTok; GLM-5.3 lists at $2.15 a MTok.
		expect(cap.weeklyCapApiUsdByFamily[glm]).toBeCloseTo(
			(10_000 / 1117.5) * 2.15,
		);
		expect(cap.by).toBe("Z.ai");
	});

	it("refuses a model with no credit rate", () => {
		expect(() => weeklyCreditCap(plan, ["glm-5-2"], listRates)).toThrow(
			/glm-5-2: no credit rate/,
		);
	});

	it("scales Z.ai's tiers with their weekly credits", () => {
		const lite = weeklyCreditCap(
			WEEKLY_CREDIT_PLANS["zai-glm-coding-lite"],
			[glm],
			listRates,
		);
		const max = weeklyCreditCap(
			WEEKLY_CREDIT_PLANS["zai-glm-coding-max"],
			[glm],
			listRates,
		);
		expect(
			max.weeklyCapApiUsdByFamily[glm] / lite.weeklyCapApiUsdByFamily[glm],
		).toBeCloseTo(14);
	});
});
