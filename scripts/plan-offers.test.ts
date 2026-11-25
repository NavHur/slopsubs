import { describe, expect, it } from "vite-plus/test";
import { checkOffers } from "./plan-offers.ts";

const blackFriday = {
	planId: "google-ai-pro-annual",
	offerEndsOn: "2026-12-01",
};

describe("checkOffers", () => {
	it("refuses a plan whose offer ended", () => {
		expect(() => checkOffers([blackFriday], "2026-12-02")).toThrow(
			"google-ai-pro-annual: the offer ended on 2026-12-01; delete the plan and its id in plan-families.ts, build-plans.ts and tests, then rebuild.",
		);
	});

	it("accepts a plan whose offer still runs, through its last day", () => {
		expect(() => checkOffers([blackFriday], "2026-11-25")).not.toThrow();
		expect(() => checkOffers([blackFriday], "2026-12-01")).not.toThrow();
	});

	it("accepts a plan with no offer end", () => {
		expect(() =>
			checkOffers([{ planId: "google-ai-pro" }], "2030-01-01"),
		).not.toThrow();
	});
});
