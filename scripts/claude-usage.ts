// Reads Claude Code's logs and prices them between two weekly-gauge marks.

import { join } from "node:path";
import { Effect, Option, Result, Schema } from "effect";
import {
	type BenchmarkPoint,
	isPercent,
	type LimitSamples,
} from "../src/domain/model.ts";
import {
	ClaudeUsage,
	claudeMessageUsd,
	modelFamilySlug,
	priceFor,
} from "../src/domain/pricing.ts";
import { UtcTimestamp } from "../src/domain/wire-schemas.ts";
import {
	decodeFileValue,
	decodeJsonFile,
	type FileReadError,
	type InvalidJsonFile,
	TextFiles,
} from "./effects/files.ts";

/** A weekly gauge reading from /usage, recorded by `measure mark`. */
export const Mark = Schema.Struct({
	at: UtcTimestamp,
	plan: Schema.NonEmptyString,
	usedPercent: Schema.Finite.check(isPercent),
	resetsAt: UtcTimestamp,
	host: Schema.String,
});
export type Mark = typeof Mark.Type;

const AssistantTag = Schema.Struct({ type: Schema.Literal("assistant") });
const ClaudeLine = Schema.Struct({
	...AssistantTag.fields,
	timestamp: UtcTimestamp,
	requestId: Schema.optional(Schema.String),
	requestRef: Schema.optional(Schema.String),
	message: Schema.Struct({
		id: Schema.String,
		model: Schema.String,
		usage: Schema.optional(Schema.NullOr(ClaudeUsage)),
	}),
});

export type ClaudeMessage = { at: number; model: string; usage: ClaudeUsage };
type PricedLine = readonly [requestKey: string, message: ClaudeMessage];
const isAssistant = Schema.is(AssistantTag);

function assistantMessage(line: string, path: string, lineNumber: number) {
	return Effect.gen(function* () {
		if (!/"type"\s*:\s*"assistant"/.test(line))
			return Option.none<PricedLine>();
		const location = `${path}:${lineNumber}`;
		const raw = yield* decodeJsonFile(Schema.Unknown, location, line);
		if (!isAssistant(raw)) return Option.none<PricedLine>();
		const { message, timestamp, requestId, requestRef } =
			yield* decodeFileValue(ClaudeLine, location, raw);
		const { usage } = message;
		if (!usage) return Option.none<PricedLine>();
		const request = requestRef ?? requestId ?? "";
		return Option.some<PricedLine>([
			`${message.id}:${request}`,
			{ at: Date.parse(timestamp), model: message.model, usage },
		]);
	});
}

function readClaudeFile(path: string, seen: Map<string, ClaudeMessage>) {
	return Effect.gen(function* () {
		const files = yield* TextFiles;
		const lines = (yield* files.read(path)).split("\n");
		for (const [index, line] of lines.entries()) {
			const entry = yield* assistantMessage(line, path, index + 1);
			if (Option.isSome(entry)) seen.set(...entry.value);
		}
	});
}

function readClaudeDir(
	dir: string,
	seen: Map<string, ClaudeMessage>,
): Effect.Effect<void, InvalidJsonFile | FileReadError, TextFiles> {
	return Effect.gen(function* () {
		const files = yield* TextFiles;
		for (const entry of yield* files.list(dir)) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) yield* readClaudeDir(path, seen);
			else if (entry.name.endsWith(".jsonl")) yield* readClaudeFile(path, seen);
		}
	});
}

/** Assistant messages from Claude Code logs, deduplicated across re-writes. */
export function readClaudeMessages(dirs: readonly string[]) {
	return Effect.gen(function* () {
		const seen = new Map<string, ClaudeMessage>();
		for (const dir of dirs) yield* readClaudeDir(dir, seen);
		return [...seen.values()];
	});
}

export function priceWindow(
	[start, end]: [Mark, Mark],
	messages: ClaudeMessage[],
	benchmarks: BenchmarkPoint[],
	unpriced: Set<string>,
): (typeof LimitSamples.Encoded)[number] {
	const from = Date.parse(start.at);
	const to = Date.parse(end.at);
	const byFamily: Record<string, number> = {};
	for (const m of messages.filter(({ at }) => at >= from && at < to)) {
		const price = priceFor(m.model, benchmarks);
		if (Result.isFailure(price)) {
			unpriced.add(price.failure.modelId);
			continue;
		}
		const family = modelFamilySlug(m.model);
		const usd = claudeMessageUsd(m.usage, price.success);
		byFamily[family] = (byFamily[family] ?? 0) + usd;
	}
	return {
		plan: start.plan,
		from: start.at,
		to: end.at,
		startUsedPercent: start.usedPercent,
		endUsedPercent: end.usedPercent,
		apiUsd: Object.values(byFamily).reduce((a, b) => a + b, 0),
		apiUsdByFamily: byFamily,
		host: start.host,
	};
}
