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
		raised: [10, 40],
		raisedOffList: [10, 40],
	},
	// A 2 $/MTok blend: the same dollars buy twice the list-priced usage.
	offListRates: { offList: [1, 5], raisedOffList: [1, 5] },
	promos: {
		discounted: { kind: "price", prices: [1, 5], promotion: halfPrice },
		raised: {
			kind: "allowance",
			usageUsd: [50, 100],
			summaries: ["Go raises it to $50", "Go Plus raises it to $100"],
			endsOn: "2026-11-30",
			url: "https://example.com/promo",
		},
		raisedOffList: {
			kind: "allowance",
			usageUsd: [50, 100],
			summaries: ["Go raises it to $50", "Go Plus raises it to $100"],
			endsOn: "2026-11-30",
			url: "https://example.com/promo",
		},
	},
};
const families = ["plain", "offList", "discounted", "raised", "raisedOffList"];

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

	it("replaces a raised family's usage with each tier's promoted figure", () => {
		const go = goPlan(pricing, GO, families, listRates);
		const goPlus = goPlan(pricing, GO_PLUS, families, listRates);
		expect([
			go.apiUsdPerMonthByFamily.raised,
			goPlus.apiUsdPerMonthByFamily.raised,
		]).toEqual([50, 100]);
	});

	it("converts a raised family billed off list at its regular Go price", () => {
		const { apiUsdPerMonthByFamily } = goPlan(pricing, GO, families, listRates);
		expect(apiUsdPerMonthByFamily.raisedOffList).toBe(100);
	});
});

describe("a Go plan's promotions", () => {
	it("lists the promotion of a family the plan includes", () => {
		const { promotionByFamily } = goPlan(
			pricing,
			GO,
			["discounted"],
			listRates,
		);
		expect(promotionByFamily).toEqual({ discounted: halfPrice });
	});

	it("gives each tier its own summary of a raised family", () => {
		const summaryOf = (tier: 0 | 1) =>
			goPlan(pricing, tier, ["raised"], listRates).promotionByFamily.raised;
		expect(summaryOf(GO)).toEqual({
			summary: "Go raises it to $50",
			endsOn: "2026-11-30",
			url: "https://example.com/promo",
		});
		expect(summaryOf(GO_PLUS)?.summary).toBe("Go Plus raises it to $100");
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
