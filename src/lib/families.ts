import { benchmarks } from "#/data";
import type { FamilyId } from "#/domain/model";

const LAB_COLORS: Record<string, string> = {
	anthropic: "light-dark(#ae5235, #df9477)",
	openai: "light-dark(#586878, #c5cbd3)",
	google: "light-dark(#218347, #56ca80)",
	xai: "light-dark(#6d55bd, #9b94ee)",
	meta: "light-dark(#1d5aa8, #4b96ff)",
	xiaomi: "light-dark(#c25a12, #ff9a52)",
	zai: "light-dark(#3557b7, #7aa2f7)",
	kimi: "light-dark(#444, #d6d6d6)",
	deepseek: "light-dark(#3047c8, #6d84ff)",
	minimax: "light-dark(#b0306a, #f06aa5)",
	alibaba: "light-dark(#6b3fb5, #b08cf5)",
};
const FALLBACK_COLOR = "light-dark(#666, #aaa)";

const firstOfFamily = new Map(
	benchmarks.models.map((m) => [m.family, m] as const).reverse(),
);

export function familyColor(family: FamilyId): string {
	const frontier = benchmarks.frontier[family];
	if (frontier) return frontier.color;
	const lab = firstOfFamily.get(family)?.lab;
	return (lab && LAB_COLORS[lab]) || FALLBACK_COLOR;
}

/** "Claude Opus 5.5" → "Opus 5.5", like the vendor's own shorthand. */
export function familyName(family: FamilyId): string {
	const name = firstOfFamily.get(family)?.name ?? family;
	return name.replace(/^Claude /, "");
}

export function familyLab(family: FamilyId): string {
	return firstOfFamily.get(family)?.labName ?? "";
}

/** Whether a "Find models" query names the family or its lab. */
export function familyMatches(family: FamilyId, query: string): boolean {
	const needle = query.trim().toLowerCase();
	const model = firstOfFamily.get(family);
	const haystack = [family, model?.name, model?.labName].join(" ");
	return haystack.toLowerCase().includes(needle);
}
