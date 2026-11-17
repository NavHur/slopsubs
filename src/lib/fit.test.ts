import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "#/domain/model";
import {
	effortLabel,
	fitInputs,
	fitWorkload,
	modelToggle,
	unitChange,
} from "./fit";
import { ViewSearch } from "./view";

const opus = "claude-opus-5-5" as FamilyId;
const fable = "claude-fable-5-2" as FamilyId;
const parseFit = (fit: unknown) => fitInputs(ViewSearch.parse({ fit }).fit);

describe("the fit param", () => {
	it("loads defaults for a link from before the section existed", () => {
		expect(
			fitInputs(ViewSearch.parse({ benchmark: "omniscience" }).fit),
		).toEqual({
			any: false,
			models: [opus],
			weights: {},
			unit: "apiUsd",
			amount: 250,
			effort: "high",
			budget: null,
		});
	});

	it("keeps the valid fields of a hand-edited link and drops the rest", () => {
		const inputs = parseFit({
			models: ["retired-model", fable],
			unit: "tokens",
			amount: -5,
			effort: "high",
			budget: 150,
		});
		expect(inputs).toMatchObject({
			models: [fable],
			unit: "apiUsd",
			amount: 250,
			budget: 150,
		});
	});

	it("counts a model repeated in a shared link once, in order", () => {
		const inputs = parseFit({ models: [fable, opus, fable] });
		expect(inputs.models).toEqual([fable, opus]);
		expect(fitWorkload(inputs).models).toEqual({
			kind: "chosen",
			weights: [
				{ family: fable, weight: 50 },
				{ family: opus, weight: 50 },
			],
		});
	});

	it("reads a fit param that isn't an object as unset", () => {
		expect(parseFit("max")).toEqual(parseFit(undefined));
	});

	it("turns tasks at an effort into a tasks workload", () => {
		const inputs = parseFit({ unit: "tasks", amount: 40, effort: "low" });
		expect(fitWorkload(inputs).usage).toEqual({
			unit: "tasks",
			tasksPerWeek: 40,
			effort: "low",
		});
	});

	it("reads effort none as reasoning off, and still drops an unknown effort", () => {
		expect(parseFit({ unit: "tasks", effort: "none" }).effort).toBe("none");
		expect(parseFit({ unit: "tasks", effort: "minimal" }).effort).toBe("high");
	});

	it("labels reasoning off as the benchmarks do", () => {
		expect(effortLabel("none")).toBe("Non-reasoning");
		expect(effortLabel("xhigh")).toBe("X-high");
		expect(effortLabel("low")).toBe("Low");
	});

	it("gives each chosen model its percent, an equal part when unset", () => {
		const inputs = parseFit({
			models: [opus, fable],
			weights: { [fable]: 75 },
		});
		expect(fitWorkload(inputs).models).toEqual({
			kind: "chosen",
			weights: [
				{ family: opus, weight: 50 },
				{ family: fable, weight: 75 },
			],
		});
	});
});

describe("modelToggle", () => {
	const chosen = (models: FamilyId[], weights = {}) => ({
		any: false,
		models,
		weights,
	});

	it("adds and removes models but keeps the last one", () => {
		expect(modelToggle(chosen([opus]), fable)).toEqual({
			models: [opus, fable],
		});
		expect(modelToggle(chosen([opus, fable]), opus)).toEqual({
			models: [fable],
			weights: {},
		});
		expect(modelToggle(chosen([opus]), opus)).toBeNull();
	});

	it("drops a removed model's share", () => {
		expect(
			modelToggle(chosen([opus, fable], { [opus]: 80, [fable]: 20 }), fable),
		).toEqual({ models: [opus], weights: { [opus]: 80 } });
	});

	it("leaves Any flagship for the picked model alone", () => {
		expect(modelToggle({ ...chosen([opus]), any: true }, fable)).toEqual({
			any: false,
			models: [fable],
			weights: undefined,
		});
	});
});

describe("unitChange", () => {
	it("starts a new unit at its own default amount", () => {
		expect(unitChange("tasks")).toEqual({ unit: "tasks", amount: 50 });
	});
});
