import type { FamilyId } from "#/domain/model";
import type { ShownDetails } from "./pointDetails";

/** The models drawn at full strength; empty when none stands out. */
export type LitModels = readonly FamilyId[];

/**
 * Models that stay lit: those of the shown points (the hovered one and the
 * pinned one it is compared with), else the highlighted model.
 */
export function litModels(
	details: ShownDetails | null,
	highlighted: FamilyId | null,
): LitModels {
	if (details) {
		const shown = [details.point, details.selected].filter((p) => p !== null);
		return [...new Set(shown.map((p) => p.benchmark.family))];
	}
	return highlighted === null ? [] : [highlighted];
}

/** Whether a model fades because others are lit and it is not one. */
export const isFaded = (lit: LitModels, family: FamilyId) =>
	lit.length > 0 && !lit.includes(family);
