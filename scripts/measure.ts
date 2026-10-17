// Measures how much API-equivalent spend fills a subscription's weekly cap.
//
//   pnpm measure mark <planId> <usedPercent> <resetsAt>
//     Record the weekly gauge from /usage, e.g.
//     pnpm measure mark claude-max-20x 37 2026-10-20T16:00
//   pnpm measure build [--claude-dir <projects dir>]...
//     Price the Claude Code logs between consecutive marks of the same weekly
//     window and write src/data/samples.json.
//
// Every host that spends the same account during a window must contribute
// its logs (copy them over and pass --claude-dir), or the window undercounts.
// ceiling: Claude Code logs only; Codex rollouts need their own reader.

import { appendFile, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import type { BenchmarkPoint, LimitSample } from "../src/domain/model.ts";
import { BenchmarkDataset, LimitSamples } from "../src/domain/model.ts";
import {
	type ClaudeUsage,
	claudeMessageUsd,
	priceFor,
	UnpricedModelError,
} from "../src/domain/pricing.ts";

const ROOT = new URL("..", import.meta.url);
const MARKS = new URL("measurements/marks.jsonl", ROOT);
const SAMPLES = new URL("src/data/samples.json", ROOT);
const BENCHMARKS = new URL("src/data/benchmarks.json", ROOT);

const Mark = z.object({
	at: z.iso.datetime(),
	plan: z.string().min(1),
	usedPercent: z.number().min(0).max(100),
	resetsAt: z.iso.datetime(),
	host: z.string(),
});
type Mark = z.infer<typeof Mark>;

const ClaudeLine = z.object({
	type: z.literal("assistant"),
	timestamp: z.iso.datetime(),
	requestId: z.string().optional(),
	requestRef: z.string().optional(),
	message: z.object({
		id: z.string(),
		model: z.string(),
		usage: z.custom<ClaudeUsage>(
			(u) =>
				z
					.object({ input_tokens: z.number(), output_tokens: z.number() })
					.safeParse(u).success,
		),
	}),
});
type ClaudeMessage = { at: number; model: string; usage: ClaudeUsage };

async function mark(args: string[]) {
	const [plan, used, resets] = args;
	if (!plan || !used || !resets) {
		throw new Error("usage: measure mark <planId> <usedPercent> <resetsAt>");
	}
	const entry = Mark.parse({
		at: new Date().toISOString(),
		plan,
		usedPercent: Number(used),
		resetsAt: new Date(resets).toISOString(),
		host: hostname(),
	});
	await appendFile(MARKS, `${JSON.stringify(entry)}\n`);
	console.log(
		`Marked ${plan} at ${entry.usedPercent}% (resets ${entry.resetsAt})`,
	);
}

async function readMarks(): Promise<Mark[]> {
	const text = await readFile(MARKS, "utf8");
	return text
		.split("\n")
		.filter(Boolean)
		.map((line) => Mark.parse(JSON.parse(line)));
}

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

async function* jsonlFiles(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* jsonlFiles(path);
		else if (entry.name.endsWith(".jsonl")) yield path;
	}
}

/** Assistant messages from Claude Code logs, deduplicated across re-writes. */
async function readClaudeMessages(dirs: string[]): Promise<ClaudeMessage[]> {
	const seen = new Map<string, ClaudeMessage>();
	for (const dir of dirs) {
		for await (const file of jsonlFiles(dir)) {
			for (const line of (await readFile(file, "utf8")).split("\n")) {
				if (!line.includes('"type":"assistant"')) continue;
				const parsed = ClaudeLine.safeParse(JSON.parse(line));
				if (!parsed.success) continue;
				const { message, timestamp, requestId, requestRef } = parsed.data;
				seen.set(`${message.id}:${requestRef ?? requestId ?? ""}`, {
					at: Date.parse(timestamp),
					model: message.model,
					usage: message.usage,
				});
			}
		}
	}
	return [...seen.values()];
}

function priceWindow(
	[start, end]: [Mark, Mark],
	messages: ClaudeMessage[],
	benchmarks: BenchmarkPoint[],
	unpriced: Set<string>,
): LimitSample {
	const from = Date.parse(start.at);
	const to = Date.parse(end.at);
	const byFamily: Record<string, number> = {};
	for (const m of messages) {
		if (m.at < from || m.at >= to) continue;
		try {
			const usd = claudeMessageUsd(m.usage, priceFor(m.model, benchmarks));
			const family = m.model.replace(/-\d{8}$/, "");
			byFamily[family] = (byFamily[family] ?? 0) + usd;
		} catch (error) {
			if (!(error instanceof UnpricedModelError)) throw error;
			unpriced.add(m.model);
		}
	}
	return {
		// SAFETY: LimitSamples.parse below brands and validates every sample.
		plan: start.plan as LimitSample["plan"],
		from: start.at,
		to: end.at,
		startUsedPercent: start.usedPercent,
		endUsedPercent: end.usedPercent,
		apiUsd: Object.values(byFamily).reduce((a, b) => a + b, 0),
		apiUsdByFamily: byFamily,
		host: start.host,
	};
}

async function build(args: string[]) {
	const { values } = parseArgs({
		args,
		options: { "claude-dir": { type: "string", multiple: true } },
	});
	const dirs = values["claude-dir"] ?? [join(homedir(), ".claude/projects")];
	const { models } = BenchmarkDataset.parse(
		JSON.parse(await readFile(BENCHMARKS, "utf8")),
	);
	const messages = await readClaudeMessages(dirs);
	const unpriced = new Set<string>();
	const samples = LimitSamples.parse(
		windows(await readMarks()).map((w) =>
			priceWindow(w, messages, models, unpriced),
		),
	);
	await writeFile(SAMPLES, `${JSON.stringify(samples, null, 2)}\n`);
	for (const s of samples) {
		const gauge = s.endUsedPercent - s.startUsedPercent;
		console.log(
			`${s.plan} ${s.from} → ${s.to}: $${s.apiUsd.toFixed(2)} for ${gauge}pp → $${((s.apiUsd / gauge) * 100).toFixed(0)}/week`,
		);
	}
	if (unpriced.size)
		console.warn(`Unpriced models skipped: ${[...unpriced].join(", ")}`);
}

const [command, ...rest] = process.argv.slice(2);
const commands: Record<string, (args: string[]) => Promise<void>> = {
	mark,
	build,
};
const run = command ? commands[command] : undefined;
if (!run) throw new Error("usage: measure <mark|build> ...");
await run(rest);
