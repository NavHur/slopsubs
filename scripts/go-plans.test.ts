import { describe, expect, it } from "vite-plus/test";
import type { Promotion } from "../src/domain/model.ts";
import { type GoPricing, goPlan } from "./go-plans.ts";
import type { TokenRates } from "./list-price.ts";

const GO = 0;
const GO_PLUS = 1;

// Every fixture family lists at [2, 10] $/MTok, a 4 $/MTok blend.
const listRates = (): TokenRates => [2, 10];

const halfPrice: Promotion = {
	summary: "half price",
	endsOn: "2026-11-30",
	url: "https://example.com/promo",
};

const pricing: GoPricing = {
	usageUsd: {
		plain: [10, 40],
		offList: [10, 40],
		discounted: [10, 40],
	},
	// A 2 $/MTok blend: the same dollars buy twice the list-priced usage.
	offListRates: { offList: [1, 5] },
	promos: { discounted: { prices: [1, 5], promotion: halfPrice } },
};
const families = ["plain", "offList", "discounted"];

describe("a Go plan's allowance", () => {
	it("passes a family billed at list price through unchanged", () => {
		const { apiUsdPerMonthByFamily } = goPlan(pricing, GO, families, listRates);
		expect(apiUsdPerMonthByFamily.plain).toBe(10);
	});

	it("takes each tier's own regular usage", () => {
		const { apiUsdPerMonthByFamily } = goPlan(
			pricing,
			GO_PLUS,
			families,
			listRates,
		);
		expect(apiUsdPerMonthByFamily.plain).toBe(40);
	});

	it("converts a family billed off list at its regular Go price", () => {
		const { apiUsdPerMonthByFamily } = goPlan(pricing, GO, families, listRates);
		expect(apiUsdPerMonthByFamily.offList).toBe(20);
	});

	it("scales a discounted family's usage by list price over the discounted price", () => {
		const { apiUsdPerMonthByFamily } = goPlan(
			pricing,
			GO_PLUS,
			families,
			listRates,
		);
		expect(apiUsdPerMonthByFamily.discounted).toBe(80);
	});
});

describe("a Go plan's promotions", () => {
	it("lists the promotion of a family the plan includes", () => {
		const { promotionByFamily } = goPlan(pricing, GO, families, listRates);
		expect(promotionByFamily).toEqual({ discounted: halfPrice });
	});

	it("leaves out a promotion on a family the plan does not list", () => {
		const { promotionByFamily } = goPlan(
			pricing,
			GO,
			["plain", "offList"],
			listRates,
		);
		expect(promotionByFamily).toEqual({});
	});
});
