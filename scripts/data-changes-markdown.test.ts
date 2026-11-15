import { describe, expect, it } from "vite-plus/test";
import type { DataChanges } from "../src/domain/data-changes.ts";
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

describe("renderDataChanges", () => {
	it("shows every kind of change", () => {
		const body = renderDataChanges({
			familiesAdded: [
				{ family: "muse-spark-1-4" as FamilyId, name: "Muse Spark 1.4" },
			],
			familiesRemoved: [{ family: "old-model" as FamilyId, name: "Old Model" }],
			scores: [
				{
					benchmark: "intelligence",
					family: astra,
					name: "GPT-6 Astra",
					effortLabel: "High",
					before: 70,
					after: 72.5,
				},
			],
			prices: [
				{
					family: astra,
					name: "GPT-6 Astra",
					before: { input: 2, output: 10 },
					after: { input: 1.5, output: 10 },
				},
			],
			planValues: [
				{
					planId: "chatgpt-pro-200" as PlanId,
					label: "Pro",
					family: astra,
					before: 21,
					after: 25,
				},
			],
			changedFiles: ["benchmarks.json", "plans.json"],
			refetchedFiles: ["frontiercode.json"],
		});
		for (const text of [
			"Muse Spark 1.4",
			"Old Model",
			"70.0 → 72.5",
			"$2 / $10 → $1.5 / $10",
			"21× → 25×",
			"`plans.json`",
			"`frontiercode.json`",
		])
			expect(body).toContain(text);
	});

	it("puts plan values before benchmark changes", () => {
		const body = renderDataChanges({
			...none,
			scores: [
				{
					benchmark: "gdp-pdf",
					family: astra,
					name: "GPT-6 Astra",
					effortLabel: "High",
					before: 40,
					after: 45,
				},
			],
			planValues: [
				{
					planId: "chatgpt-plus" as PlanId,
					label: "Plus",
					family: astra,
					before: 10.5,
					after: null,
				},
			],
		});
		expect(body.indexOf("Plan value")).toBeLessThan(body.indexOf("Scores"));
		expect(body).toContain("no known cap");
	});
});
