import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { Plan, PlanId } from "#/domain/model";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { familyName } from "#/lib/families";
import { FRONTIER_FAMILIES } from "#/lib/view";
import { FamilyList, PlanList } from "./Sidebar";

const benchmarkName = BENCHMARK_VIEWS.frontiercode.tabLabel;
const [scored, unscored] = FRONTIER_FAMILIES;

function rows() {
	const html = renderToStaticMarkup(
		<FamilyList
			selected={[]}
			filters={null}
			isDefault
			coverage={{ benchmarkName, scored: new Set([scored]) }}
			onSelect={() => {}}
			onReset={() => {}}
		/>,
	);
	return html.split("<li>");
}

describe("FamilyList", () => {
	it("notes only the families with no score on the active benchmark", () => {
		const note = `No ${benchmarkName} score`;
		const rowOf = (family: typeof scored) =>
			rows().find((row) => row.includes(`>${familyName(family)}<`));
		expect(rowOf(unscored)).toContain(note);
		expect(rowOf(scored)).not.toContain(note);
	});
});

/** A plan whose vendor publishes an allowance for none of its models. */
const uncoveredPlan: Plan = {
	id: "uncovered-plan" as PlanId,
	vendor: "Vendor",
	lab: "anthropic",
	label: "Uncovered",
	monthlyPriceUsd: 20,
	harnesses: ["Harness"],
	families: [scored],
	limits: "monthly allowance",
	includedApiCreditUsd: 0,
	allowanceKind: "rate-window",
	thirdPartyHarnessAllowed: false,
	confidence: "primary",
	sourceUrl: "https://example.com/pricing",
	reportedCap: null,
	publishedAllowance: {
		apiUsdPerMonthByFamily: { [unscored]: 100 },
		url: "https://example.com/allowance",
		basis: "Per-model monthly usage",
	},
	weeklyShareByFamily: {},
	maxEffortByFamily: {},
	promotionByFamily: {},
};

describe("PlanList", () => {
	it("says the API row follows the plans' models", () => {
		const html = renderToStaticMarkup(
			<PlanList
				plans={[uncoveredPlan]}
				selected={[]}
				styles={new Map()}
				showApi
				onToggle={() => {}}
				onToggleApi={() => {}}
			/>,
		);
		expect(html).toContain("list price, plan models");
	});

	it("shows a dash, not Infinity, for a plan with no multiple", () => {
		const html = renderToStaticMarkup(
			<PlanList
				plans={[uncoveredPlan]}
				selected={[]}
				styles={new Map()}
				showApi={false}
				onToggle={() => {}}
				onToggleApi={() => {}}
			/>,
		);
		const row = html.split("<li>").find((r) => r.includes(">Uncovered<"));
		expect(row).toContain(">—</a>");
		expect(html).not.toContain("Infinity");
	});

	it("labels credit plans, and only them", () => {
		const credit: Plan = {
			...uncoveredPlan,
			id: "credit-plan" as PlanId,
			label: "Credits",
			allowanceKind: "credit",
		};
		const html = renderToStaticMarkup(
			<PlanList
				plans={[uncoveredPlan, credit]}
				selected={[]}
				styles={new Map()}
				showApi={false}
				onToggle={() => {}}
				onToggleApi={() => {}}
			/>,
		);
		const rowOf = (label: string) =>
			html.split("<li>").find((r) => r.includes(`>${label}<`));
		expect(rowOf("Credits")).toContain(">credit</span>");
		expect(rowOf("Uncovered")).not.toContain(">credit</span>");
	});

	it("lists the unmeasured plans by vendor, with the models each includes", () => {
		const unmeasured = (id: string, vendor: string): Plan => ({
			...uncoveredPlan,
			id: id as PlanId,
			vendor,
			label: id,
			publishedAllowance: null,
			families: [scored, unscored],
		});
		const html = renderToStaticMarkup(
			<PlanList
				plans={[
					unmeasured("alpha-one", "Alpha"),
					unmeasured("beta-one", "Beta"),
					unmeasured("alpha-two", "Alpha"),
				]}
				selected={[]}
				styles={new Map()}
				showApi={false}
				onToggle={() => {}}
				onToggleApi={() => {}}
			/>,
		);
		const section = html.slice(html.indexOf("Not yet measured"));
		expect(section.match(/<h3[^>]*>(Alpha|Beta)<\/h3>/g)).toHaveLength(2);
		expect(section.indexOf(">alpha-two<")).toBeLessThan(
			section.indexOf(">beta-one<"),
		);
		expect(section).toContain(`${familyName(scored)}, ${familyName(unscored)}`);
	});

	it("shows an unmeasured plan's limits in a disclosure, not only a tooltip", () => {
		const html = renderToStaticMarkup(
			<PlanList
				plans={[
					{
						...uncoveredPlan,
						label: "Unmeasured",
						limits: "5x higher usage limits",
						publishedAllowance: null,
					},
				]}
				selected={[]}
				styles={new Map()}
				showApi={false}
				onToggle={() => {}}
				onToggleApi={() => {}}
			/>,
		);
		expect(html).toMatch(
			/<details[^>]*><summary[^>]*>Limits<\/summary><p>5x higher usage limits<\/p><\/details>/,
		);
		expect(html).toContain('aria-label="Limits for Unmeasured"');
	});
});
