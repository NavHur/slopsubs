import type { BenchmarkPoint } from "./model.ts";

const TOKENS_PER_MTOK = 1_000_000;

/** Anthropic prompt-caching multipliers on the base input price. */
const ANTHROPIC_CACHE = {
	read: 0.1,
	write5m: 1.25,
	write1h: 2,
} as const;

/** The `usage` block Claude Code writes on each assistant message. */
export type ClaudeUsage = {
	input_tokens: number;
	output_tokens: number;
	cache_read_input_tokens?: number;
	cache_creation_input_tokens?: number;
	cache_creation?: {
		ephemeral_5m_input_tokens?: number;
		ephemeral_1h_input_tokens?: number;
	};
};

type TokenPrice = { inputPerMTokUsd: number; outputPerMTokUsd: number };

export class UnpricedModelError extends Error {}

/**
 * Per-token price for a model id as logged by a harness. Dated snapshots
 * (`claude-opus-5-5-20261001`) resolve to their family.
 */
export function priceFor(
	modelId: string,
	benchmarks: readonly BenchmarkPoint[],
): TokenPrice {
	const family = modelId.replace(/-\d{8}$/, "");
	const priced = benchmarks.find(
		(b) =>
			b.family === family &&
			b.inputPricePerMTokUsd !== null &&
			b.outputPricePerMTokUsd !== null,
	);
	if (!priced?.inputPricePerMTokUsd || !priced.outputPricePerMTokUsd) {
		throw new UnpricedModelError(`No API price for model ${modelId}`);
	}
	return {
		inputPerMTokUsd: priced.inputPricePerMTokUsd,
		outputPerMTokUsd: priced.outputPricePerMTokUsd,
	};
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
