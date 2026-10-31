import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { BenchmarkPoint, FamilyId, Plan, PlanId } from "#/domain/model";
import { tasksPerWeek } from "#/domain/ranges";
import { valuePoints } from "#/domain/value";
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
		weeklyCapApiUsd: 50,
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

function markup() {
	const points = valuePoints({
		benchmarks: [benchmark],
		families: [opus],
		plans: [plan],
		samples: [],
		showApi: false,
		hiddenEfforts: [],
	});
	return renderToStaticMarkup(<TasksChart plans={tasksPerWeek(points)} />);
}

describe("TasksChart", () => {
	it("shows where a plan's cap comes from as visible text", () => {
		const text = `${capBasis}. Not measured yet.`;
		const elementText = markup().replaceAll("&#x27;", "'");
		expect(elementText).toContain(`>${text}</`);
	});
});
