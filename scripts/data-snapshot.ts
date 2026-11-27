import { Commands } from "./effects/commands.ts";
// Reads the generated data files from the working tree or a git ref, and
// compares them, for the refresh scripts.

import { Data, Effect, Schema } from "effect";
import {
	type DataSnapshot,
	GENERATED_FILES,
	summarizeDataChanges,
} from "../src/domain/data-changes.ts";
import { SUPERSEDED_AA_EVAL } from "../src/domain/enums.ts";
import {
	AaEvalsDataset,
	BenchmarkDataset,
	ChartData,
	FrontierCodeDataset,
	LimitSamples,
	Plans,
} from "../src/domain/model.ts";
import {
	decodeFileValue,
	decodeJsonFile,
	type InvalidJsonFile,
	TextFiles,
} from "./effects/files.ts";

const ROOT = new URL("..", import.meta.url);
const DATA_DIR = "src/data/";
/** Room for `git show` of the largest generated file, several times over. */
const GIT_SHOW_MAX_BYTES = 64 * 1024 * 1024;

type FileName =
	| (typeof GENERATED_FILES)[keyof typeof GENERATED_FILES]
	| "samples.json";
type Texts = Record<keyof typeof GENERATED_FILES | "samples", string>;

class GitReadError extends Data.TaggedError("GitReadError")<{
	ref: string;
	file: FileName;
	cause: unknown;
}> {
	override get message() {
		return `Cannot read ${this.file} at ${this.ref}: ${String(this.cause)}`;
	}
}

const readGitFile = Effect.fnUntraced(function* (ref: string, file: FileName) {
	const commands = yield* Commands;
	return yield* commands
		.capture("git", ["show", "--end-of-options", `${ref}:${DATA_DIR}${file}`], {
			cwd: ROOT,
			maxBuffer: GIT_SHOW_MAX_BYTES,
		})
		.pipe(Effect.mapError((cause) => new GitReadError({ ref, file, cause })));
});

function readTexts<E, R>(
	read: (file: FileName) => Effect.Effect<string, E, R>,
) {
	return Effect.all(
		{
			benchmarks: read(GENERATED_FILES.benchmarks),
			aaEvals: read(GENERATED_FILES.aaEvals),
			frontierCode: read(GENERATED_FILES.frontierCode),
			chart: read(GENERATED_FILES.chart),
			plans: read(GENERATED_FILES.plans),
			samples: read("samples.json"),
		},
		{ concurrency: "unbounded" },
	);
}

const successorId = (id: string) =>
	id === SUPERSEDED_AA_EVAL.id ? SUPERSEDED_AA_EVAL.successor : id;

/** `value` with every string, and object key, that is the superseded eval id
 * renamed to its successor. */
function renameSupersededEval(value: unknown): unknown {
	if (typeof value === "string") return successorId(value);
	if (Array.isArray(value)) return value.map(renameSupersededEval);
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			successorId(key),
			renameSupersededEval(item),
		]),
	);
}

const keepAsWritten = (raw: unknown) => raw;

function decodeDataset<S extends Schema.Constraint>(
	schema: S,
	path: string,
	text: string,
	upgrade: (raw: unknown) => unknown,
) {
	return Effect.gen(function* () {
		// The raw JSON also matters when comparing metadata the schema drops, so
		// it stays as written; only what the schema decodes is upgraded.
		const raw = yield* decodeJsonFile(Schema.Unknown, path, text);
		const data = yield* decodeFileValue(schema, path, upgrade(raw));
		return { data, raw };
	});
}

function decodeSnapshot(
	texts: Texts,
	label: (file: FileName) => string,
	upgrade: (raw: unknown) => unknown,
): Effect.Effect<DataSnapshot, InvalidJsonFile> {
	return Effect.gen(function* () {
		const { benchmarks, aaEvals, frontierCode, chart, plans } =
			yield* Effect.all({
				benchmarks: decodeDataset(
					BenchmarkDataset,
					label(GENERATED_FILES.benchmarks),
					texts.benchmarks,
					upgrade,
				),
				aaEvals: decodeDataset(
					AaEvalsDataset,
					label(GENERATED_FILES.aaEvals),
					texts.aaEvals,
					upgrade,
				),
				frontierCode: decodeDataset(
					FrontierCodeDataset,
					label(GENERATED_FILES.frontierCode),
					texts.frontierCode,
					upgrade,
				),
				chart: decodeDataset(
					ChartData,
					label(GENERATED_FILES.chart),
					texts.chart,
					upgrade,
				),
				plans: decodeDataset(
					Plans,
					label(GENERATED_FILES.plans),
					texts.plans,
					upgrade,
				),
			});
		return {
			benchmarks: benchmarks.data,
			aaEvals: aaEvals.data,
			frontierCode: frontierCode.data,
			chart: chart.data,
			plans: plans.data,
			samples: yield* decodeJsonFile(
				LimitSamples,
				label("samples.json"),
				texts.samples,
			),
			raw: {
				benchmarks: benchmarks.raw,
				aaEvals: aaEvals.raw,
				frontierCode: frontierCode.raw,
				chart: chart.raw,
				plans: plans.raw,
			},
		};
	});
}

/** What the working tree's data changed since `ref`, and `ref`'s files. */
export function changesSince(ref: string) {
	return Effect.gen(function* () {
		const files = yield* TextFiles;
		const [base, current] = yield* Effect.all(
			[
				readTexts((file) => readGitFile(ref, file)),
				readTexts((file) => files.read(new URL(DATA_DIR + file, ROOT))),
			],
			{ concurrency: 2 },
		);
		return { changes: yield* compareTexts(ref, base, current), base };
	});
}

/**
 * Decode errors name `ref:path` for the base copy and the path for current.
 * The base may predate the Terminal-Bench 4.1 rename, so its copy decodes
 * under the successor id; the current copy stays strict.
 */
export function compareTexts(ref: string, base: Texts, current: Texts) {
	return Effect.gen(function* () {
		const before = yield* decodeSnapshot(
			base,
			(file) => `${ref}:${DATA_DIR}${file}`,
			renameSupersededEval,
		);
		const after = yield* decodeSnapshot(
			current,
			(file) => DATA_DIR + file,
			keepAsWritten,
		);
		return summarizeDataChanges(before, after);
	});
}

/** Puts `ref`'s generated files back, undoing a refresh that only refetched. */
export function restore(base: Texts) {
	return Effect.gen(function* () {
		const files = yield* TextFiles;
		for (const key of Object.keys(
			GENERATED_FILES,
		) as (keyof typeof GENERATED_FILES)[]) {
			yield* files.write(
				new URL(DATA_DIR + GENERATED_FILES[key], ROOT),
				base[key],
			);
		}
	});
}
