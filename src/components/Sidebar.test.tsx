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
});
