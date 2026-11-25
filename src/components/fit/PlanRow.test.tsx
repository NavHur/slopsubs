import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { FamilyId, Plan } from "#/domain/model";
import { PlanRow } from "./PlanRow";

const argon = "gemini-4-argon" as FamilyId;
const opus = "claude-opus-5-5" as FamilyId;
const promotionUrl = "https://example.com/model-pricing";

function plan(overrides: Partial<Plan> = {}): Plan {
	return {
		id: "test-plan",
		vendor: "Test",
		lab: "test",
		label: "Test Plan",
		monthlyPriceUsd: 20,
		harnesses: ["Claude Code"],
		families: [argon, opus],
		limits: "weekly cap",
		allowanceKind: "rate-window",
		includedApiCreditUsd: 0,
		thirdPartyHarnessAllowed: false,
		confidence: "primary",
		sourceUrl: "https://example.com/pricing",
		reportedCap: null,
		publishedAllowance: null,
		weeklyShareByFamily: {},
		maxEffortByFamily: {},
		promotionByFamily: {},
		...overrides,
	} as Plan;
}

const promoted = plan({
	promotionByFamily: {
		[argon]: {
			summary: "Test bills Gemini 4 Argon at 50% off, doubling its usage",
			endsOn: "2026-11-30",
			url: promotionUrl,
		},
	},
});

function html(row: Plan, families: FamilyId[]): string {
	return renderToStaticMarkup(
		<ul>
			<PlanRow
				plan={row}
				basis="published"
				share={0.5}
				shareLabel="50% used"
				detail="Fits with headroom."
				families={families}
			/>
		</ul>,
	);
}

describe("PlanRow", () => {
	it("says a promotion is behind the fit, until when, and links its source", () => {
		const row = html(promoted, [argon]);
		expect(row).toContain("Promo until Nov 30, 2026:");
		expect(row).toContain("Test bills Gemini 4 Argon at 50% off");
		expect(row).toMatch(
			new RegExp(`<a href="${promotionUrl}"[^>]*>.*?Source</a>`),
		);
	});

	it("stays quiet when the week uses no promoted model", () => {
		expect(html(promoted, [opus])).not.toContain("Promo");
	});

	it("marks a price from secondary sources with an asterisk and says so", () => {
		const row = html(plan({ confidence: "secondary" }), [argon]);
		expect(row).toContain('title="Price from secondary sources"');
		expect(row).toContain("$20*");
	});

	it("leaves a primary-sourced price unmarked", () => {
		const row = html(plan(), [argon]);
		expect(row).not.toContain("Price from");
		expect(row).not.toContain("*");
	});

	it("stays quiet for a plan with no promotion", () => {
		const row = html(plan(), [argon]);
		expect(row).not.toContain("Promo");
		expect(row).not.toContain(promotionUrl);
	});
});
