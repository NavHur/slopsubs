// Reads per-model Intelligence Index evals out of an AA model page's Next.js
// flight payload and files them under the catalog's families and efforts.

import type { AaEvalId } from "./eval-units";
import { AA_EVAL_IDS, type BenchmarkPoint, type Effort } from "./model";
import { roundedOrNull } from "./rounding";

/** Website release slugs the catalog files under another family. */
const FAMILY_ALIASES: Record<string, string> = {
	"qwen3-8-max-0902": "qwen3-8-max",
};

const CHUNK_MARKER = "__next_f.push([1,";
const EVALS_KEY = '"intelligenceIndexEvaluations":';
const RELEASE_PATTERN = /"release":\{"slug":"([^"]+)"/g;
const EFFORT_PATTERN = /"effort":\{"slug":"([^"]+)"/g;
const REASONING_PATTERN = /"isReasoning":(true|false)/g;
const MODEL_START_PATTERN = /\{"id":"[0-9a-f-]{36}","slug":"/g;
/** How far before an evals array its model's record starts. */
const LOOKBACK = 8000;
/** The longest evals array the scan will follow. */
const MAX_ARRAY_LENGTH = 20000;
const BRACKET_DELTA: Record<string, number> = { "[": 1, "]": -1 };

/** A website row. `effort` is the website's slug, `none` for an effortless model
 * that does not reason, and null for one that does. */
export type EvalRow = {
	family: string;
	effort: string | null;
	eval: AaEvalId;
	score: number;
	costPerTaskUsd: number | null;
	tokensPerTask: number | null;
	secondsPerTask: number | null;
};

/** A website row filed under the catalog's family and effort. */
export type ResolvedRow = EvalRow & { effort: Effort };

type RawEval = {
	slug: string;
	score: number;
	outputTokensPerTask?: number;
	costPerTask?: number;
	timePerTask?: number;
};

const isAaEvalId = (slug: string): slug is AaEvalId =>
	(AA_EVAL_IDS as readonly string[]).includes(slug);

/** Index of the quote closing the string literal opened at `open`. */
function stringLiteralEnd(text: string, open: number): number {
	let i = open + 1;
	while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
	return i;
}

/** The string literal of the push chunk starting at `marker`, decoded. */
function decodeChunk(
	html: string,
	marker: number,
): { text: string; next: number } {
	const open = marker + CHUNK_MARKER.length;
	if (html[open] !== '"')
		throw new Error(`Flight chunk at offset ${marker} has no string literal`);
	const close = stringLiteralEnd(html, open);
	try {
		return { text: JSON.parse(html.slice(open, close + 1)), next: close + 1 };
	} catch (cause) {
		throw new Error(`Flight chunk at offset ${marker} is not a JSON string`, {
			cause,
		});
	}
}

/** Reconstructs the React Flight string from Next.js push chunks. */
export function flightFromHtml(html: string): string {
	const chunks: string[] = [];
	let marker = html.indexOf(CHUNK_MARKER);
	while (marker >= 0) {
		const chunk = decodeChunk(html, marker);
		chunks.push(chunk.text);
		marker = html.indexOf(CHUNK_MARKER, chunk.next);
	}
	if (!chunks.length) throw new Error("No flight chunks found in model page");
	return chunks.join("");
}

/** End of the bracketed array starting at `start`, or -1 if it never closes. */
function arrayEnd(text: string, start: number): number {
	const limit = Math.min(text.length, start + MAX_ARRAY_LENGTH);
	let depth = 0;
	for (let i = start; i < limit; i++) {
		if (text[i] === '"') i = stringLiteralEnd(text, i);
		depth += BRACKET_DELTA[text[i]] ?? 0;
		if (depth === 0) return i + 1;
	}
	return -1;
}

function lastMatch(text: string, pattern: RegExp): RegExpExecArray | null {
	return [...text.matchAll(pattern)].at(-1) ?? null;
}

/** A record's own effort slug: `none` for an effortless model that does not
 * reason, null for one that does, filed under the family's default or only variant. */
function recordEffort(record: string, family: string): string | null {
	const effort = lastMatch(record, EFFORT_PATTERN)?.[1];
	if (effort) return effort;
	const reasons = lastMatch(record, REASONING_PATTERN)?.[1];
	if (!reasons) throw new Error(`No effort or isReasoning for ${family}`);
	return reasons === "true" ? null : "none";
}

/** Family and own effort of the model whose evals sit at `keyIndex`, read only
 * from its record (`{"id":…` to `"release"`), since an effortless one has none. */
function modelBefore(
	flight: string,
	keyIndex: number,
): { family: string; effort: string | null } | null {
	const before = flight.slice(Math.max(0, keyIndex - LOOKBACK), keyIndex);
	const release = lastMatch(before, RELEASE_PATTERN);
	if (!release) return null;
	const family = release[1];
	const start = lastMatch(before.slice(0, release.index), MODEL_START_PATTERN);
	if (!start)
		throw new Error(`No model record starts before the evals of ${family}`);
	const record = before.slice(start.index, release.index);
	return { family, effort: recordEffort(record, family) };
}

function toRow(
	family: string,
	effort: string | null,
	e: RawEval & { slug: AaEvalId },
): EvalRow {
	return {
		family,
		effort,
		eval: e.slug,
		score: e.score,
		costPerTaskUsd: roundedOrNull(e.costPerTask, 5),
		tokensPerTask: roundedOrNull(e.outputTokensPerTask, 0),
		secondsPerTask: roundedOrNull(e.timePerTask, 1),
	};
}

function parseEvals(raw: string, family: string): RawEval[] {
	try {
		return JSON.parse(raw);
	} catch (cause) {
		throw new Error(`Evals array for ${family} is not valid JSON`, { cause });
	}
}

/** The chart-eval rows of the evals array whose key sits at `keyIndex`. */
function rowsAt(flight: string, keyIndex: number): EvalRow[] {
	const model = modelBefore(flight, keyIndex);
	if (!model) return [];
	const start = keyIndex + EVALS_KEY.length;
	const end = arrayEnd(flight, start);
	if (end < 0)
		throw new Error(
			`Evals array for ${model.family} at offset ${start} does not close within ${MAX_ARRAY_LENGTH} characters`,
		);
	return parseEvals(flight.slice(start, end), model.family)
		.filter((e): e is RawEval & { slug: AaEvalId } => isAaEvalId(e.slug))
		.map((e) => toRow(model.family, model.effort, e));
}

/** Extracts per-model eval rows from the flight payload. */
export function extractEvals(flight: string): EvalRow[] {
	return [...flight.matchAll(new RegExp(`${EVALS_KEY}\\[`, "g"))].flatMap(
		(found) => rowsAt(flight, found.index),
	);
}

/** The catalog model a website effort names; null when the catalog lacks it.
 * A null effort is a reasoning model with no named effort. */
export function pickModel(
	candidates: BenchmarkPoint[],
	effort: string | null,
	family: string,
): BenchmarkPoint | null {
	if (effort !== null)
		return candidates.find((m) => m.effort === effort) ?? null;
	const [only, ...rest] = candidates;
	if (!rest.length) return only.effort === "none" ? null : only;
	const fallback = candidates.find((m) => m.effort === "default");
	if (!fallback) throw new Error(`Ambiguous null effort for ${family}`);
	return fallback;
}

/** Website rows the import skipped, and efforts it filed under a sole default. */
export type Skips = {
	families: Set<string>;
	efforts: Set<string>;
	mappedToDefault: Set<string>;
};

type Resolution = {
	byFamily: Map<string, BenchmarkPoint[]>;
	/** Each catalog family's distinct website efforts. */
	siteEfforts: Map<string, Set<string | null>>;
	skips: Skips;
};

const catalogFamily = (r: EvalRow) => FAMILY_ALIASES[r.family] ?? r.family;

/** The family's one default model, when the website lists it at one effort. */
function soleDefault(
	candidates: BenchmarkPoint[],
	siteEffortCount: number,
): BenchmarkPoint | null {
	const [only, ...rest] = candidates;
	return siteEffortCount === 1 && !rest.length && only.effort === "default"
		? only
		: null;
}

/** The row filed under the catalog's family and effort, or null if skipped. */
function resolveRow(r: EvalRow, resolution: Resolution): ResolvedRow | null {
	const { byFamily, skips } = resolution;
	const family = catalogFamily(r);
	const candidates = byFamily.get(family);
	if (!candidates) {
		skips.families.add(r.family);
		return null;
	}
	const exact = pickModel(candidates, r.effort, family);
	const siteEffortCount = resolution.siteEfforts.get(family)?.size ?? 0;
	const match = exact ?? soleDefault(candidates, siteEffortCount);
	if (!match) {
		// The website carries efforts the catalog can't price; they skip the chart.
		skips.efforts.add(`${r.family} (${r.effort ?? "reasoning"})`);
		return null;
	}
	if (!exact) skips.mappedToDefault.add(`${r.family} (${r.effort})`);
	return { ...r, family, effort: match.effort };
}

function siteEffortsOf(raw: EvalRow[]): Map<string, Set<string | null>> {
	const efforts = new Map<string, Set<string | null>>();
	for (const r of raw) {
		const family = catalogFamily(r);
		efforts.set(family, (efforts.get(family) ?? new Set()).add(r.effort));
	}
	return efforts;
}

/** Resolves rows against the catalog, failing loud on duplicates. */
export function resolveRows(
	raw: EvalRow[],
	byFamily: Map<string, BenchmarkPoint[]>,
) {
	const skips: Skips = {
		families: new Set(),
		efforts: new Set(),
		mappedToDefault: new Set(),
	};
	const resolution = { byFamily, siteEfforts: siteEffortsOf(raw), skips };
	const rows = new Map<string, ResolvedRow>();
	for (const r of raw) {
		const row = resolveRow(r, resolution);
		if (!row) continue;
		const key = `${row.family}@${row.effort}@${row.eval}`;
		if (rows.has(key)) throw new Error(`Two rows for ${key}`);
		rows.set(key, row);
	}
	return { rows: [...rows.values()], skips };
}
