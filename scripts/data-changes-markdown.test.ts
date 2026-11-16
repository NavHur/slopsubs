import { describe, expect, it } from "vite-plus/test";
import type {
	DataChanges,
	ScoreChange,
	ValueChange,
} from "../src/domain/data-changes.ts";
import type { FamilyId, PlanId } from "../src/domain/model.ts";
import { renderDataChanges } from "./data-changes-markdown.ts";

const astra = "gpt-6-astra" as FamilyId;

const none: DataChanges = {
	familiesAdded: [],
	familiesRemoved: [],
	scores: [],
	prices: [],
	planValues: [],
	changedFiles: [],
	refetchedFiles: [],
};

const scoreChange: ScoreChange = {
	benchmark: "intelligence",
	family: astra,
	name: "GPT-6 Astra",
	effortLabel: "High",
	before: 70,
	after: 72.5,
};

const valueChange: ValueChange = {
	planId: "chatgpt-pro-200" as PlanId,
	label: "Pro",
	family: astra,
	name: "GPT-6 Astra",
	before: 21,
	after: 25,
};

const VALUE_NUMBERS = /: (\S+) → (\S+) API value per dollar/;
const INPUT_PRICES = /: (\S+) \/ \S+ → (\S+) \/ \S+ per MTok/;
const OUTPUT_PRICES = /: \S+ \/ (\S+) → \S+ \/ (\S+) per MTok/;

/** The printed before and after numbers a pattern captures from the body. */
function movesOf(body: string, pattern: RegExp): [string, string] {
	const match = pattern.exec(body);
	if (!match) throw new Error(`No line matches ${pattern} in:\n${body}`);
	return [match[1], match[2]];
}

describe("renderDataChanges", () => {
	it("shows every kind of change", () => {
		const body = renderDataChanges({
			familiesAdded: [
				{ family: "muse-spark-1-4" as FamilyId, name: "Muse Spark 1.4" },
			],
			familiesRemoved: [{ family: "old-model" as FamilyId, name: "Old Model" }],
			scores: [scoreChange],
			prices: [
				{
					family: astra,
					name: "GPT-6 Astra",
					before: { input: 2, output: 10 },
					after: { input: 1.5, output: 10 },
				},
			],
			planValues: [valueChange],
			changedFiles: ["benchmarks.json", "plans.json"],
			refetchedFiles: ["frontiercode.json"],
		});
		for (const text of [
			"Muse Spark 1.4",
			"Old Model",
			"70.0 → 72.5",
			"$2 / $10 → $1.5 / $10",
			"21× → 25×",
			"GPT-6 Astra (`gpt-6-astra`)",
			"`plans.json`",
			"`frontiercode.json`",
		])
			expect(body).toContain(text);
	});

	it.each([
		[21, 21.4],
		[0.01, 0.01002],
	])("tells a plan value of %d and %d apart", (before, after) => {
		const body = renderDataChanges({
			...none,
			planValues: [{ ...valueChange, before, after }],
		});
		const [was, now] = movesOf(body, VALUE_NUMBERS);
		expect(was).not.toBe(now);
	});

	it.each([
		["input", INPUT_PRICES, 0.141, 0.144],
		["input", INPUT_PRICES, 2, 2.004],
		["input", INPUT_PRICES, 1.23456781, 1.23456782],
		["output", OUTPUT_PRICES, 100.1, 100.4],
	])(
		"tells a list price %s that rounds the same apart",
		(side, pattern, was, now) => {
			const body = renderDataChanges({
				...none,
				prices: [
					{
						family: astra,
						name: "GPT-6 Astra",
						before: { input: 5, output: 5, [side]: was },
						after: { input: 5, output: 5, [side]: now },
					},
				],
			});
			const [before, after] = movesOf(body, pattern);
			expect(before).not.toBe(after);
		},
	);

	it("shows a score point that appeared or lost its score", () => {
		const body = renderDataChanges({
			...none,
			scores: [
				{ ...scoreChange, effortLabel: "Low", before: null },
				{ ...scoreChange, effortLabel: "Max", after: null },
			],
		});
		expect(body).toContain("(Low) new");
		expect(body).toContain("(Max) 70.0, no longer scored");
	});

	it("ends a refetch-only body with a line starting 'No data changed.'", () => {
		const body = renderDataChanges({
			...none,
			refetchedFiles: ["benchmarks.json", "chart-benchmarks.json"],
		});
		const lastLine = body.split("\n").at(-1) ?? "";
		expect(lastLine.startsWith("No data changed.")).toBe(true);
	});

	it("does not start the last line 'No data changed.' when files changed", () => {
		const body = renderDataChanges({
			...none,
			scores: [scoreChange],
			changedFiles: ["chart-benchmarks.json"],
			refetchedFiles: ["benchmarks.json"],
		});
		const lastLine = body.split("\n").at(-1) ?? "";
		expect(lastLine.startsWith("No data changed.")).toBe(false);
	});
});
