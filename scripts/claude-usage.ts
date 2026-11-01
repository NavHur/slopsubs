// Reads Claude Code's logs and prices them between two weekly-gauge marks.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { BenchmarkPoint, LimitSample } from "../src/domain/model.ts";
import {
	type ClaudeUsage,
	claudeMessageUsd,
	priceFor,
	UnpricedModelError,
} from "../src/domain/pricing.ts";

/** A weekly gauge reading from /usage, recorded by `measure mark`. */
export const Mark = z.object({
	at: z.iso.datetime(),
	plan: z.string().min(1),
	usedPercent: z.number().min(0).max(100),
	resetsAt: z.iso.datetime(),
	host: z.string(),
});
export type Mark = z.infer<typeof Mark>;

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
export type ClaudeMessage = { at: number; model: string; usage: ClaudeUsage };

async function* jsonlFiles(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* jsonlFiles(path);
		else if (entry.name.endsWith(".jsonl")) yield path;
	}
}

/** Every line of every .jsonl file under `dirs`. */
async function* logLines(dirs: string[]): AsyncGenerator<string> {
	for (const dir of dirs) {
		for await (const file of jsonlFiles(dir))
			yield* (await readFile(file, "utf8")).split("\n");
	}
}

/** The message an assistant line records, keyed by message and request so a
 * re-written line replaces its earlier copy; null for any other line. */
function parseAssistantLine(line: string): [string, ClaudeMessage] | null {
	if (!line.includes('"type":"assistant"')) return null;
	const parsed = ClaudeLine.safeParse(JSON.parse(line));
	if (!parsed.success) return null;
	const { message, timestamp, requestId, requestRef } = parsed.data;
	const request = requestRef ?? requestId ?? "";
	return [
		`${message.id}:${request}`,
		{ at: Date.parse(timestamp), model: message.model, usage: message.usage },
	];
}

/** Assistant messages from Claude Code logs, deduplicated across re-writes. */
export async function readClaudeMessages(
	dirs: string[],
): Promise<ClaudeMessage[]> {
	const seen = new Map<string, ClaudeMessage>();
	for await (const line of logLines(dirs)) {
		const entry = parseAssistantLine(line);
		if (entry) seen.set(...entry);
	}
	return [...seen.values()];
}

/** A dated snapshot's date, as in `claude-opus-5-5-20261001`. */
const DATED_SNAPSHOT_SUFFIX = /-\d{8}$/;

/** What a message would have cost through the API; null when no benchmark
 * prices its model. */
function apiUsd(
	message: ClaudeMessage,
	benchmarks: BenchmarkPoint[],
): number | null {
	try {
		return claudeMessageUsd(message.usage, priceFor(message.model, benchmarks));
	} catch (error) {
		if (error instanceof UnpricedModelError) return null;
		throw error;
	}
}

export function priceWindow(
	[start, end]: [Mark, Mark],
	messages: ClaudeMessage[],
	benchmarks: BenchmarkPoint[],
	unpriced: Set<string>,
): LimitSample {
	const from = Date.parse(start.at);
	const to = Date.parse(end.at);
	const byFamily: Record<string, number> = {};
	for (const m of messages.filter(({ at }) => at >= from && at < to)) {
		const usd = apiUsd(m, benchmarks);
		if (usd === null) {
			unpriced.add(m.model);
			continue;
		}
		const family = m.model.replace(DATED_SNAPSHOT_SUFFIX, "");
		byFamily[family] = (byFamily[family] ?? 0) + usd;
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
