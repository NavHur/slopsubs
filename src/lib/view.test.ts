import { describe, expect, it } from "vite-plus/test";
import { leaderboards } from "#/data";
import type { FamilyId } from "#/domain/model";
import { familyMatches } from "./families";
import {
	allSelected,
	codeOnlyApplies,
	DEFAULT_MODELS_VIEW,
	FRONTIER_FAMILIES,
	frontierTier,
	hiddenReasoning,
	isDefaultModelsView,
	NOTABLE_FAMILIES,
	plottedLeaderboard,
	selectedFamilies,
	toggledGroup,
	ViewSearch,
} from "./view";

const opus = "claude-opus-5-5" as FamilyId;
const haiku = "claude-haiku-5-5" as FamilyId;
const kimi = "kimi-k3" as FamilyId;
const view = (search: object) => ViewSearch.parse(search);

describe("hiddenReasoning", () => {
	it("hides only the non-reasoning variant by default", () => {
		expect(hiddenReasoning(view({}))).toEqual(["none"]);
	});

	it("reads the hidden efforts from the URL, including none hidden", () => {
		expect(hiddenReasoning(view({ hideReasoning: ["max", "low"] }))).toEqual([
			"max",
			"low",
		]);
		expect(hiddenReasoning(view({ hideReasoning: [] }))).toEqual([]);
	});

	it("rejects efforts the panel cannot hide", () => {
		expect(() => view({ hideReasoning: ["default"] })).toThrow();
	});
});

describe("labels", () => {
	it("shows the line labels unless the URL turns them off", () => {
		expect(view({}).labels).toBe(true);
		expect(view({ labels: false }).labels).toBe(false);
	});
});

describe("code only", () => {
	it("is off unless the URL turns it on", () => {
		expect(view({}).code).toBe(false);
		expect(view({ code: true }).code).toBe(true);
	});

	it("swaps the coding score in for the Intelligence Index", () => {
		expect(plottedLeaderboard(view({}))).toBe("intelligence");
		expect(plottedLeaderboard(view({ code: true }))).toBe("coding");
	});

	it("leaves FrontierCode alone, which is a coding eval already", () => {
		const frontierCode = view({ benchmark: "frontiercode", code: true });
		expect(codeOnlyApplies("frontiercode")).toBe(false);
		expect(plottedLeaderboard(frontierCode)).toBe("frontiercode");
	});

	it("hides models never run on the coding evals", () => {
		const scored = (id: "intelligence" | "coding") =>
			new Set(leaderboards[id].models.map((m) => m.family));
		expect(scored("intelligence").has(kimi)).toBe(true);
		expect(scored("coding").has(kimi)).toBe(false);
		expect(scored("coding").has(opus)).toBe(true);
	});

	it("counts as a model filter the reset clears", () => {
		const codeOnly = view({ code: true });
		expect(isDefaultModelsView(codeOnly)).toBe(false);
		expect(view({ ...codeOnly, ...DEFAULT_MODELS_VIEW }).code).toBe(false);
	});
});

describe("old shared links", () => {
	it("still load when they carry the removed usage profile", () => {
		expect(() => view({ profile: "heavy" })).not.toThrow();
		expect(view({ profile: "heavy" })).toEqual(view({}));
	});
});

describe("isDefaultModelsView", () => {
	it("holds for the default view and its explicit equivalent", () => {
		const explicit = view({
			families: [...selectedFamilies(view({}))].reverse(),
			hideReasoning: ["none"],
		});
		expect(isDefaultModelsView(view({}))).toBe(true);
		expect(isDefaultModelsView(explicit)).toBe(true);
	});

	it("fails once a model or effort changes", () => {
		expect(isDefaultModelsView(view({ families: [opus] }))).toBe(false);
		expect(isDefaultModelsView(view({ hideReasoning: [] }))).toBe(false);
	});
});

describe("model groups", () => {
	it("splits covered families into frontier and notable", () => {
		expect(FRONTIER_FAMILIES).toContain(opus);
		expect(NOTABLE_FAMILIES).toContain(kimi);
		expect(FRONTIER_FAMILIES.every((f) => frontierTier(f) !== null)).toBe(true);
		expect(NOTABLE_FAMILIES.every((f) => frontierTier(f) === null)).toBe(true);
	});

	it("selects the whole group unless all of it is already selected", () => {
		expect(toggledGroup([kimi, opus], [opus, haiku])).toEqual([
			kimi,
			opus,
			haiku,
		]);
		expect(toggledGroup([kimi, opus, haiku], [opus, haiku])).toEqual([kimi]);
	});

	it("never counts an empty group as selected", () => {
		expect(allSelected([opus], [])).toBe(false);
	});
});

describe("familyMatches", () => {
	it("matches the model name, its lab, or a blank query, ignoring case", () => {
		expect(familyMatches(opus, "OPUS")).toBe(true);
		expect(familyMatches(opus, "claude opus")).toBe(true);
		expect(familyMatches(opus, "anthropic")).toBe(true);
		expect(familyMatches(opus, "  ")).toBe(true);
		expect(familyMatches(opus, "gemini")).toBe(false);
	});
});
