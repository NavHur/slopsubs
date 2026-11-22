import { Data, Result, Schema } from "effect";
import type { BenchmarkPoint } from "./model.ts";

const TOKENS_PER_MTOK = 1_000_000;

/** Anthropic prompt-caching multipliers on the base input price. */
const ANTHROPIC_CACHE = {
	read: 0.1,
	write5m: 1.25,
	write1h: 2,
} as const;

const TokenCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const OptionalCount = Schema.optional(Schema.NullOr(TokenCount));

/** The usage counters that affect the price of a Claude Code message. */
export const ClaudeUsage = Schema.Struct({
	input_tokens: TokenCount,
	output_tokens: TokenCount,
	cache_read_input_tokens: OptionalCount,
	cache_creation_input_tokens: OptionalCount,
	cache_creation: Schema.optional(
		Schema.NullOr(
			Schema.Struct({
				ephemeral_5m_input_tokens: OptionalCount,
				ephemeral_1h_input_tokens: OptionalCount,
			}),
		),
	),
});
export type ClaudeUsage = typeof ClaudeUsage.Type;

type TokenPrice = { inputPerMTokUsd: number; outputPerMTokUsd: number };

export class UnpricedModelError extends Data.TaggedError("UnpricedModelError")<{
	modelId: string;
}> {
	override get message() {
		return `No API price for model ${this.modelId}`;
	}
}

export const modelFamilySlug = (modelId: string) =>
	modelId.replace(/-\d{8}$/, "");

/**
 * Per-token price for a model id as logged by a harness. Dated snapshots
 * (`claude-opus-5-5-20261001`) resolve to their family.
 */
export function priceFor(
	modelId: string,
	benchmarks: readonly BenchmarkPoint[],
): Result.Result<TokenPrice, UnpricedModelError> {
	const family = modelFamilySlug(modelId);
	const priced = benchmarks.find(
		(b) =>
			b.family === family &&
			b.inputPricePerMTokUsd !== null &&
			b.outputPricePerMTokUsd !== null,
	);
	if (!priced?.inputPricePerMTokUsd || !priced.outputPricePerMTokUsd) {
		return Result.fail(new UnpricedModelError({ modelId }));
	}
	return Result.succeed({
		inputPerMTokUsd: priced.inputPricePerMTokUsd,
		outputPerMTokUsd: priced.outputPricePerMTokUsd,
	});
}

/** What one Claude message would have cost through the API. */
export function claudeMessageUsd(
	usage: ClaudeUsage,
	price: TokenPrice,
): number {
	const cacheWrite = usage.cache_creation_input_tokens ?? 0;
	const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
	const write5m = cacheWrite - write1h;
	const inputEquivalent =
		usage.input_tokens +
		(usage.cache_read_input_tokens ?? 0) * ANTHROPIC_CACHE.read +
		write5m * ANTHROPIC_CACHE.write5m +
		write1h * ANTHROPIC_CACHE.write1h;
	return (
		(inputEquivalent * price.inputPerMTokUsd +
			usage.output_tokens * price.outputPerMTokUsd) /
		TOKENS_PER_MTOK
	);
}
