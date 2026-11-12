import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "#/domain/model";
import type { PlottableBenchmark, ValuePoint } from "#/domain/value";
import { isFaded, litModels } from "./litModels";

const gpt = "gpt-5" as FamilyId;
const haiku = "claude-haiku-5-5" as FamilyId;
const gemini = "gemini-3" as FamilyId;

function point(family: FamilyId): ValuePoint {
	return {
		seriesId: `${family}@api`,
		benchmark: { id: `${family}-low`, family } as PlottableBenchmark,
		score: 40,
		costPerTaskUsd: 1,
		pricing: { kind: "api" },
	};
}

describe("litModels", () => {
	it("keeps the selected model lit while another is hovered", () => {
		const details = {
			point: point(haiku),
			pinned: false,
			selected: point(gpt),
		};
		const lit = litModels(details, null);
		expect(lit).toEqual(expect.arrayContaining([haiku, gpt]));
		expect(isFaded(lit, gpt)).toBe(false);
		expect(isFaded(lit, haiku)).toBe(false);
		expect(isFaded(lit, gemini)).toBe(true);
	});

	it("lists a family once when both points share it", () => {
		const details = { point: point(gpt), pinned: false, selected: point(gpt) };
		expect(litModels(details, null)).toEqual([gpt]);
	});

	it("lights the shown point's model over a highlighted one", () => {
		const details = { point: point(haiku), pinned: true, selected: null };
		expect(litModels(details, gemini)).toEqual([haiku]);
	});

	it("lights the highlighted model when no point shows", () => {
		expect(litModels(null, gemini)).toEqual([gemini]);
	});

	it("falls back to the resting models when nothing else stands out", () => {
		expect(litModels(null, null, [gpt, haiku])).toEqual([gpt, haiku]);
		expect(litModels(null, gemini, [gpt])).toEqual([gemini]);
	});

	it("fades nothing when nothing stands out", () => {
		expect(isFaded(litModels(null, null), gpt)).toBe(false);
	});
});
