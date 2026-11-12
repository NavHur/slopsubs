import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { BenchmarkPoint, FamilyId, Plan, PlanId } from "#/domain/model";
import { tasksPerWeek } from "#/domain/ranges";
import { valuePoints } from "#/domain/value";
import { familyColor } from "#/lib/families";
import { TasksChart } from "./TasksChart";

const opus = "claude-opus-5-5" as FamilyId;
const capBasis = "Half Theo's Ultra figure (Max is 5x Pro weekly, Ultra 10x)";

const plan: Plan = {
	id: "claude-max-5x" as PlanId,
	vendor: "Claude Code",
	lab: "anthropic",
	label: "Claude Max",
	monthlyPriceUsd: 100,
	harnesses: ["Claude Code"],
	families: [opus],
	limits: "weekly cap",
	includedApiCreditUsd: 0,
	thirdPartyHarnessAllowed: false,
	confidence: "primary",
	sourceUrl: "https://example.com/pricing",
	reportedCap: {
		weeklyCapApiUsdByFamily: { [opus]: 50 },
		by: "Theo",
		url: "https://example.com/video",
		basis: capBasis,
	},
	publishedAllowance: null,
	weeklyShareByFamily: {},
	maxEffortByFamily: {},
	promotionByFamily: {},
};

const benchmark: BenchmarkPoint = {
	id: "opus-low",
	family: opus,
	name: "Opus",
	lab: "anthropic",
	labName: "Anthropic",
	deprecated: false,
	effort: "low",
	effortLabel: "low",
	effortOrder: 2,
	score: 40,
	costPerTaskUsd: 2,
	tokensPerTask: 1000,
	secondsPerTask: null,
	inputPricePerMTokUsd: 5,
	outputPricePerMTokUsd: 25,
};

function markup(onPlan = plan, benchmarks = [benchmark]) {
	const points = valuePoints({
		benchmarks,
		families: onPlan.families,
		plans: [onPlan],
		samples: [],
		showApi: false,
		hiddenEfforts: [],
	});
	return renderToStaticMarkup(<TasksChart plans={tasksPerWeek(points)} />);
}

describe("TasksChart", () => {
	it("shows where a plan's cap comes from as visible text", () => {
		const text = `${capBasis}. Not measured by us yet.`;
		const elementText = markup().replaceAll("&#x27;", "'");
		expect(elementText).toContain(`>${text}</`);
	});

	it("heads a plan with its fullest cap and says why a model's quota is smaller", () => {
		const fable = "claude-fable-5-2" as FamilyId;
		const withFable: Plan = {
			...plan,
			families: [opus, fable],
			reportedCap: {
				...plan.reportedCap!,
				weeklyCapApiUsdByFamily: { [fable]: 20, [opus]: 50 },
			},
			weeklyShareByFamily: { [fable]: 0.5 },
		};
		const html = markup(withFable, [
			benchmark,
			{ ...benchmark, id: "fable-low", family: fable, name: "Fable" },
		]);
		expect(html).toContain("$50 a week at API prices");
		expect(html).toContain(
			"half the weekly cap, fills it 2.5× faster than Opus 5.5",
		);
	});

	it("names each model in the text colour, its brand on an SVG dot the PNG export draws", () => {
		const html = markup();
		const brand = familyColor(opus);
		expect(html).not.toContain(`style="color:${brand}`);
		const dot = html.match(
			/<svg aria-hidden="true"[^>]*><circle[^>]*fill="([^"]*)"/,
		);
		expect(dot?.[1]).toBe(brand);
	});
});
