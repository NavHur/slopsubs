// Renders a refresh's change set as the body of the standing refresh PR.

import type {
	DataChanges,
	FamilyChange,
	PriceChange,
	ScoreChange,
	ValueChange,
} from "../src/domain/data-changes.ts";
import { BENCHMARK_VIEWS } from "../src/lib/benchmarks.ts";
import { formatMultiple, formatUsd } from "../src/lib/format.ts";

/** Lines past this per section are counted, not listed, to keep the PR readable. */
const MAX_LINES_PER_SECTION = 40;

/** Why a body with new data can still list nothing. */
const UNLISTED_CHANGES =
	"No plan value, price, score or model changed. The new data is in figures this summary leaves out, such as cost per task, or in score moves under 0.1 points.";

function section(title: string, lines: string[]): string[] {
	if (!lines.length) return [];
	const shown = lines.slice(0, MAX_LINES_PER_SECTION);
	const more = lines.length - shown.length;
	return [
		`### ${title}`,
		"",
		...shown,
		...(more ? [`- …and ${more} more`] : []),
		"",
	];
}

/** The move between two scores as shown, to the tenth both are printed at. */
function signed(before: number, after: number): string {
	const tenths = Math.round(after * 10) - Math.round(before * 10);
	return `${tenths > 0 ? "+" : "−"}${(Math.abs(tenths) / 10).toFixed(1)}`;
}

function scoreLine(s: ScoreChange): string {
	const view = BENCHMARK_VIEWS[s.benchmark];
	return `- ${view.tabLabel}: ${s.name} (${s.effortLabel}) ${view.formatScore(s.before)} → ${view.formatScore(s.after)} (${signed(s.before, s.after)})`;
}

function usdOrNone(value: number | null): string {
	return value === null ? "none" : formatUsd(value);
}

function priceLine(p: PriceChange): string {
	const was = `${usdOrNone(p.before.input)} / ${usdOrNone(p.before.output)}`;
	const now = `${usdOrNone(p.after.input)} / ${usdOrNone(p.after.output)}`;
	return `- ${p.name}: ${was} → ${now} per MTok (input / output)`;
}

function multipleOrNoCap(value: number | null): string {
	return value === null ? "no known cap" : formatMultiple(value);
}

function valueLine(v: ValueChange): string {
	return `- ${v.label}, ${v.family}: ${multipleOrNoCap(v.before)} → ${multipleOrNoCap(v.after)} API value per dollar`;
}

function familyLine({ name, family }: FamilyChange): string {
	return `- ${name} (\`${family}\`)`;
}

function fileList(files: readonly string[]): string {
	return files.map((f) => `\`${f}\``).join(", ");
}

/** The PR body: plan values first, since those are what people buy on. */
export function renderDataChanges(changes: DataChanges): string {
	const lines = [
		...section("Plan value multiples", changes.planValues.map(valueLine)),
		...section("List prices", changes.prices.map(priceLine)),
		...section("Scores", changes.scores.map(scoreLine)),
		...section("Models AA added", changes.familiesAdded.map(familyLine)),
		...section("Models AA dropped", changes.familiesRemoved.map(familyLine)),
	];
	const changed = changes.changedFiles.length
		? `Files with new data: ${fileList(changes.changedFiles)}.`
		: "No data changed.";
	const refetched = changes.refetchedFiles.length
		? ` Only refetched: ${fileList(changes.refetchedFiles)}.`
		: "";
	const unlisted =
		!lines.length && changes.changedFiles.length ? [UNLISTED_CHANGES, ""] : [];
	return [...lines, ...unlisted, changed + refetched].join("\n");
}
