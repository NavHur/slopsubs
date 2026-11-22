// Runs the four data imports, then reports what changed since --base.
// Flags and behavior: README.md, "Benchmark Data".

import { spawnSync } from "node:child_process";
import { Effect } from "effect";
import { hasDataChanges } from "../src/domain/data-changes.ts";
import { renderDataChanges } from "./data-changes-markdown.ts";
import { changesSince, restore } from "./data-snapshot.ts";
import { TextFiles } from "./effects/files.ts";

type Args = {
	importFlags: string[];
	base: string;
	summary?: string;
};

const IMPORT_FLAGS = new Set(["--allow-score-drift", "--allow-missing-cost"]);

/** The value after a flag, which must be there. */
function valueOf(argv: string[], i: number): string {
	const value = argv[i + 1];
	if (value === undefined || value.startsWith("--"))
		throw new Error(`${argv[i]} needs a value`);
	return value;
}

function parseArgs(argv: string[]): Args {
	const args: Args = { importFlags: [], base: "HEAD" };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (IMPORT_FLAGS.has(arg)) args.importFlags.push(arg);
		else if (arg === "--base") args.base = valueOf(argv, i++);
		else if (arg === "--summary") args.summary = valueOf(argv, i++);
		else throw new Error(`Unknown argument ${arg}`);
	}
	return args;
}

/** import-benchmarks writes the catalog that import-aa-evals and import-frontiercode read;
 * build-plans reads all three outputs, so it runs last. */
function steps(importFlags: string[]): [script: string, args: string[]][] {
	return [
		["import-benchmarks", importFlags],
		["import-aa-evals", []],
		["import-frontiercode", []],
		["build-plans", []],
	];
}

function runStep(script: string, args: string[]): void {
	console.log(`\n▶ ${script} ${args.join(" ")}`.trimEnd());
	const result = spawnSync("bun", ["run", script, ...args], {
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status === 0) return;
	const code = result.status ?? 1;
	console.error(
		`\nrefresh-data: ${script} failed (exit ${code}${result.signal ? `, ${result.signal}` : ""}); the steps after it did not run.`,
	);
	process.exit(code);
}

const main = Effect.gen(function* () {
	const args = parseArgs(process.argv.slice(2));
	for (const [script, flags] of steps(args.importFlags)) runStep(script, flags);

	const { changes, base } = yield* changesSince(args.base);
	const changed = hasDataChanges(changes);
	if (!changed) yield* restore(base);
	const summary = renderDataChanges(changes);
	const files = yield* TextFiles;
	if (args.summary) yield* files.write(args.summary, `${summary}\n`);
	console.log(
		changed
			? `\nData changed since ${args.base}:\n\n${summary}`
			: `\nNo data changed since ${args.base}; kept its files and fetch dates.`,
	);
});

await Effect.runPromise(main.pipe(Effect.provide(TextFiles.layer)));
