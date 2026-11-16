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

function scoreMove(s: ScoreChange, format: (score: number) => string): string {
	const { before, after } = s;
	if (before !== null && after !== null) {
		return `${format(before)} → ${format(after)} (${signed(before, after)})`;
	}
	if (after !== null) return `new, ${format(after)}`;
	if (before !== null) return `${format(before)}, no longer scored`;
	throw new Error(`Score change without a score: ${s.family}@${s.effortLabel}`);
}

function scoreLine(s: ScoreChange): string {
	const view = BENCHMARK_VIEWS[s.benchmark];
	return `- ${view.tabLabel}: ${s.name} (${s.effortLabel}) ${scoreMove(s, view.formatScore)}`;
}

type Formatter = (value: number) => string;

/** Coarsest first: a pair that reads the same at one is shown at the next. */
const USD_FORMATS: readonly [Formatter, ...Formatter[]] = [
	formatUsd,
	(value) => `$${Number(value.toPrecision(4))}`,
	(value) => `$${Number(value.toPrecision(8))}`,
];
const MULTIPLE_FORMATS: readonly [Formatter, ...Formatter[]] = [
	formatMultiple,
	(value) => `${value.toFixed(2)}×`,
	(value) => `${value.toFixed(4)}×`,
];

/** Both sides as text, finer than usual when the usual would match. */
function formatPair(
	was: number | null,
	now: number | null,
	formats: readonly [Formatter, ...Formatter[]],
	missing: string,
): [string, string] {
	if (was === null || now === null) {
		const show = (value: number | null) =>
			value === null ? missing : formats[0](value);
		return [show(was), show(now)];
	}
	const format = formats.find((f) => f(was) !== f(now)) ?? formats[0];
	return [format(was), format(now)];
}

function priceLine(p: PriceChange): string {
	const input = formatPair(p.before.input, p.after.input, USD_FORMATS, "none");
	const output = formatPair(
		p.before.output,
		p.after.output,
		USD_FORMATS,
		"none",
	);
	return `- ${p.name}: ${input[0]} / ${output[0]} → ${input[1]} / ${output[1]} per MTok (input / output)`;
}

function valueLine(v: ValueChange): string {
	const [was, now] = formatPair(
		v.before,
		v.after,
		MULTIPLE_FORMATS,
		"no known cap",
	);
	return `- ${v.label}, ${v.name} (\`${v.family}\`): ${was} → ${now} API value per dollar`;
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
		...section(
			"Models added to the catalog",
			changes.familiesAdded.map(familyLine),
		),
		...section(
			"Models dropped from the catalog",
			changes.familiesRemoved.map(familyLine),
		),
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
