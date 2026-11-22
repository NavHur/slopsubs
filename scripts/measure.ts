// Measures how much API-equivalent spend fills a subscription's weekly cap.
//
//   bun run measure mark <planId> <usedPercent> <resetsAt>
//     Record the weekly gauge from /usage, e.g.
//     bun run measure mark claude-max-20x 37 2026-10-20T16:00
//   bun run measure build [--claude-dir <projects dir>]...
//     Price the Claude Code logs between consecutive marks of the same weekly
//     window and write src/data/samples.json.
//
// Every host that spends the same account during a window must contribute
// its logs (copy them over and pass --claude-dir), or the window undercounts.
// ceiling: Claude Code logs only; Codex rollouts need their own reader.

import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Clock, Effect, Schema } from "effect";
import { BenchmarkDataset, LimitSamples } from "../src/domain/model.ts";
import { Mark, priceWindow, readClaudeMessages } from "./claude-usage.ts";
import { InvalidCommandArguments } from "./effects/arguments.ts";
import { decodeJsonFile, readJsonFile, TextFiles } from "./effects/files.ts";
import { MarkArgs } from "./measure-args.ts";

const ROOT = new URL("..", import.meta.url);
const MARKS = new URL("measurements/marks.jsonl", ROOT);
const SAMPLES = new URL("src/data/samples.json", ROOT);
const BENCHMARKS = new URL("src/data/benchmarks.json", ROOT);

function mark(args: string[]) {
	return Effect.gen(function* () {
		const [plan, usedPercent, resets] =
			yield* Schema.decodeUnknownEffect(MarkArgs)(args);
		const entry = yield* Schema.decodeUnknownEffect(Mark)({
			at: new Date(yield* Clock.currentTimeMillis).toISOString(),
			plan,
			usedPercent,
			resetsAt: resets.toISOString(),
			host: hostname(),
		});
		const files = yield* TextFiles;
		yield* files.append(MARKS, `${JSON.stringify(entry)}\n`);
		console.log(
			`Marked ${plan} at ${entry.usedPercent}% (resets ${entry.resetsAt})`,
		);
	});
}

const readMarks = Effect.gen(function* () {
	const files = yield* TextFiles;
	const text = yield* files.read(MARKS);
	const lines = [...text.split("\n").entries()].filter(
		([, line]) => line.length > 0,
	);
	return yield* Effect.forEach(lines, ([index, line]) =>
		decodeJsonFile(Mark, `${MARKS.href}:${index + 1}`, line),
	);
});
/** Consecutive marks of one plan inside one weekly window, gauge rising. */
function windows(marks: Mark[]): [Mark, Mark][] {
	const sorted = [...marks].sort((a, b) => a.at.localeCompare(b.at));
	return sorted.flatMap((start, i) => {
		const end = sorted
			.slice(i + 1)
			.find((m) => m.plan === start.plan && m.resetsAt === start.resetsAt);
		if (!end || end.usedPercent <= start.usedPercent) return [];
		return [[start, end] as [Mark, Mark]];
	});
}

const BuildOptions = Schema.Struct({
	"claude-dir": Schema.optional(Schema.Array(Schema.NonEmptyString)),
});

function buildOptions(args: string[]) {
	return Effect.try({
		try: () =>
			parseArgs({
				args,
				options: { "claude-dir": { type: "string", multiple: true } },
			}).values,
		catch: (cause) =>
			new InvalidCommandArguments({ message: String(cause), cause }),
	}).pipe(Effect.flatMap(Schema.decodeUnknownEffect(BuildOptions)));
}

function build(args: string[]) {
	return Effect.gen(function* () {
		const options = yield* buildOptions(args);
		const dirs = options["claude-dir"] ?? [join(homedir(), ".claude/projects")];
		const { models } = yield* readJsonFile(BenchmarkDataset, BENCHMARKS);
		const messages = yield* readClaudeMessages(dirs);
		const unpriced = new Set<string>();
		const marks = yield* readMarks;
		const samples = yield* Schema.decodeUnknownEffect(LimitSamples)(
			windows(marks).map((window) =>
				priceWindow(window, messages, models, unpriced),
			),
		);
		const files = yield* TextFiles;
		yield* files.write(SAMPLES, `${JSON.stringify(samples, null, 2)}\n`);

		for (const s of samples) {
			const gauge = s.endUsedPercent - s.startUsedPercent;
			console.log(
				`${s.plan} ${s.from} → ${s.to}: $${s.apiUsd.toFixed(2)} for ${gauge}pp → $${((s.apiUsd / gauge) * 100).toFixed(0)}/week`,
			);
		}
		if (unpriced.size)
			console.warn(`Unpriced models skipped: ${[...unpriced].join(", ")}`);
	});
}

const main = Effect.gen(function* () {
	const [command, ...args] = process.argv.slice(2);
	switch (command) {
		case "mark":
			return yield* mark(args);
		case "build":
			return yield* build(args);
		default:
			return yield* new InvalidCommandArguments({
				message: "usage: measure <mark|build> ...",
			});
	}
});

await Effect.runPromise(main.pipe(Effect.provide(TextFiles.layer)));
