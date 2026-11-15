// Reads the generated data files from the working tree or a git ref, and
// compares them, for the refresh scripts.

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
	type DataChanges,
	type DataSnapshot,
	GENERATED_FILES,
	type GeneratedFile,
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

const ROOT = new URL("..", import.meta.url);
const DATA_DIR = "src/data/";
const run = promisify(execFile);
/** Room for `git show` of the largest generated file, several times over. */
const GIT_SHOW_MAX_BYTES = 64 * 1024 * 1024;

type FileName = GeneratedFile | "samples.json";
type Texts = Record<FileName, string>;
type Reader = (file: FileName) => Promise<string>;

const FILES: FileName[] = [...Object.values(GENERATED_FILES), "samples.json"];

const fromWorkingTree: Reader = (file) =>
	readFile(new URL(DATA_DIR + file, ROOT), "utf8");

function fromRef(ref: string): Reader {
	return async (file) =>
		(
			await run("git", ["show", `${ref}:${DATA_DIR}${file}`], {
				cwd: ROOT,
				maxBuffer: GIT_SHOW_MAX_BYTES,
			})
		).stdout;
}

async function readTexts(read: Reader): Promise<Texts> {
	const texts = await Promise.all(FILES.map(read));
	return Object.fromEntries(FILES.map((f, i) => [f, texts[i]])) as Texts;
}

function parse(texts: Texts): DataSnapshot {
	const json = (file: FileName): unknown => JSON.parse(texts[file]);
	return {
		benchmarks: BenchmarkDataset.parse(json("benchmarks.json")),
		aaEvals: AaEvalsDataset.parse(json("aa-evals.json")),
		frontierCode: FrontierCodeDataset.parse(json("frontiercode.json")),
		chart: ChartData.parse(json("chart-benchmarks.json")),
		plans: Plans.parse(json("plans.json")),
		samples: LimitSamples.parse(json("samples.json")),
	};
}

/** What the working tree's data changed since `ref`, and `ref`'s files. */
export async function changesSince(
	ref: string,
): Promise<{ changes: DataChanges; base: Texts }> {
	const [base, current] = await Promise.all([
		readTexts(fromRef(ref)),
		readTexts(fromWorkingTree),
	]);
	return { changes: summarizeDataChanges(parse(base), parse(current)), base };
}

/** Puts `ref`'s generated files back, undoing a refresh that only refetched. */
export async function restore(base: Texts): Promise<void> {
	await Promise.all(
		Object.values(GENERATED_FILES).map((file) =>
			writeFile(new URL(DATA_DIR + file, ROOT), base[file]),
		),
	);
}

/** Records a step output for GitHub Actions; a no-op elsewhere. */
export async function setOutput(name: string, value: string): Promise<void> {
	const path = process.env.GITHUB_OUTPUT;
	if (path) await writeFile(path, `${name}=${value}\n`, { flag: "a" });
}
