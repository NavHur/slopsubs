// Reads the generated data files from the working tree or a git ref, and
// compares them, for the refresh scripts.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Data, Effect, Schema } from "effect";
import {
	type DataSnapshot,
	GENERATED_FILES,
	summarizeDataChanges,
} from "../src/domain/data-changes.ts";
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
const run = promisify(execFile);
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

function readGitFile(ref: string, file: FileName) {
	return Effect.tryPromise({
		try: (signal) =>
			run("git", ["show", "--end-of-options", `${ref}:${DATA_DIR}${file}`], {
				cwd: ROOT,
				maxBuffer: GIT_SHOW_MAX_BYTES,
				signal,
			}).then(({ stdout }) => stdout),
		catch: (cause) => new GitReadError({ ref, file, cause }),
	});
}

function readTexts<E>(read: (file: FileName) => Effect.Effect<string, E>) {
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

function decodeDataset<S extends Schema.Constraint>(
	schema: S,
	path: string,
	text: string,
) {
	return Effect.gen(function* () {
		// The raw JSON also matters when comparing metadata the schema drops.
		const raw = yield* decodeJsonFile(Schema.Unknown, path, text);
		const data = yield* decodeFileValue(schema, path, raw);
		return { data, raw };
	});
}

function decodeSnapshot(
	texts: Texts,
	label: (file: FileName) => string,
): Effect.Effect<DataSnapshot, InvalidJsonFile> {
	return Effect.gen(function* () {
		const { benchmarks, aaEvals, frontierCode, chart, plans } =
			yield* Effect.all({
				benchmarks: decodeDataset(
					BenchmarkDataset,
					label(GENERATED_FILES.benchmarks),
					texts.benchmarks,
				),
				aaEvals: decodeDataset(
					AaEvalsDataset,
					label(GENERATED_FILES.aaEvals),
					texts.aaEvals,
				),
				frontierCode: decodeDataset(
					FrontierCodeDataset,
					label(GENERATED_FILES.frontierCode),
					texts.frontierCode,
				),
				chart: decodeDataset(
					ChartData,
					label(GENERATED_FILES.chart),
					texts.chart,
				),
				plans: decodeDataset(Plans, label(GENERATED_FILES.plans), texts.plans),
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

/** Decode errors name `ref:path` for the base copy and the path for current. */
export function compareTexts(ref: string, base: Texts, current: Texts) {
	return Effect.gen(function* () {
		const before = yield* decodeSnapshot(
			base,
			(file) => `${ref}:${DATA_DIR}${file}`,
		);
		const after = yield* decodeSnapshot(current, (file) => DATA_DIR + file);
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
