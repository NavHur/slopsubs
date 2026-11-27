import { Commands } from "./effects/commands.ts";
// Runs the four data imports, then reports what changed since --base.
// Flags and behavior: README.md, "Benchmark Data".

import { Data, Effect, Layer, Schema } from "effect";
import { hasDataChanges } from "../src/domain/data-changes.ts";
import { renderDataChanges } from "./data-changes-markdown.ts";
import { changesSince, restore } from "./data-snapshot.ts";
import { decodeArgument, FlagValue } from "./effects/arguments.ts";
import { TextFiles } from "./effects/files.ts";

type Args = {
	importFlags: string[];
	base: string;
	summary?: string;
};

const Flag = Schema.Literals([
	"--allow-score-drift",
	"--allow-missing-cost",
	"--base",
	"--summary",
]);

function parseArgs(argv: string[]) {
	return Effect.gen(function* () {
		const args: Args = { importFlags: [], base: "HEAD" };
		for (let i = 0; i < argv.length; i++) {
			const token = argv[i];
			const flag = yield* decodeArgument(
				Flag,
				token,
				`Unknown argument ${token}`,
			);
			switch (flag) {
				case "--allow-score-drift":
				case "--allow-missing-cost":
					args.importFlags.push(flag);
					break;
				case "--base":
					args.base = yield* decodeArgument(
						FlagValue,
						argv[++i],
						`${flag} needs a value`,
					);
					break;
				case "--summary":
					args.summary = yield* decodeArgument(
						FlagValue,
						argv[++i],
						`${flag} needs a value`,
					);
					break;
			}
		}
		return args;
	});
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

class RefreshStepFailed extends Data.TaggedError("RefreshStepFailed")<{
	script: string;
	status: number;
	signal: NodeJS.Signals | null;
	cause?: unknown;
}> {
	override get message() {
		const detail = this.signal ? `, ${this.signal}` : "";
		return `refresh-data: ${this.script} failed (exit ${this.status}${detail}); the steps after it did not run.`;
	}
}

function runStep(script: string, args: string[]) {
	return Effect.gen(function* () {
		console.log(`\n▶ ${script} ${args.join(" ")}`.trimEnd());
		const commands = yield* Commands;
		const result = yield* commands
			.inherit("bun", ["run", script, ...args])
			.pipe(
				Effect.mapError(
					(cause) =>
						new RefreshStepFailed({ script, status: 1, signal: null, cause }),
				),
			);
		if (result.status !== 0)
			return yield* new RefreshStepFailed({
				script,
				status: result.status,
				signal: result.signal,
			});
	});
}

const main = Effect.gen(function* () {
	const args = yield* parseArgs(process.argv.slice(2));
	for (const [script, flags] of steps(args.importFlags))
		yield* runStep(script, flags);

	const { changes, base } = yield* changesSince(args.base);
	const changed = hasDataChanges(changes);
	if (!changed) yield* restore(base);
	const summary = yield* renderDataChanges(changes);
	const files = yield* TextFiles;
	if (args.summary) yield* files.write(args.summary, `${summary}\n`);
	console.log(
		changed
			? `\nData changed since ${args.base}:\n\n${summary}`
			: `\nNo data changed since ${args.base}; kept its files and fetch dates.`,
	);
});

await Effect.runPromise(
	main.pipe(
		Effect.catchTag("RefreshStepFailed", (error) =>
			Effect.sync(() => {
				console.error(`\n${error.message}`);
				if (error.cause) console.error(error.cause);
				process.exitCode = error.status;
			}),
		),
		Effect.provide(Layer.mergeAll(TextFiles.layer, Commands.layer)),
	),
);
