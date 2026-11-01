import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BenchmarkPoint, FamilyId } from "../src/domain/model.ts";
import {
	type ClaudeMessage,
	type Mark,
	priceWindow,
	readClaudeMessages,
} from "./claude-usage.ts";

const usage = (input: number) => ({ input_tokens: input, output_tokens: 0 });

type Line = {
	id: string;
	at: string;
	requestId?: string;
	requestRef?: string;
	input?: number;
};

/** One assistant line as Claude Code writes it. */
function assistantLine({ id, at, requestId, requestRef, input = 1 }: Line) {
	return JSON.stringify({
		type: "assistant",
		timestamp: at,
		requestId,
		requestRef,
		message: { id, model: "claude-opus-5-5", usage: usage(input) },
	});
}

describe("readClaudeMessages", () => {
	let root: string;
	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "claude-usage-"));
	});
	afterEach(() => rm(root, { recursive: true, force: true }));

	async function write(path: string, lines: string[]) {
		await mkdir(join(root, path, ".."), { recursive: true });
		await writeFile(join(root, path), lines.join("\n"));
	}

	it("reads assistant messages from .jsonl files in nested directories", async () => {
		await write("a/session.jsonl", [
			JSON.stringify({ type: "user", timestamp: "2026-10-01T00:00:00Z" }),
			assistantLine({ id: "m1", at: "2026-10-01T00:00:00Z", input: 7 }),
			"",
		]);
		await write("a/b/c/other.jsonl", [
			assistantLine({ id: "m2", at: "2026-10-02T00:00:00Z" }),
		]);
		await write("a/notes.txt", [
			assistantLine({ id: "m3", at: "2026-10-03T00:00:00Z" }),
		]);
		const messages = await readClaudeMessages([join(root, "a")]);
		expect(messages).toHaveLength(2);
		expect(messages).toContainEqual({
			at: Date.parse("2026-10-01T00:00:00Z"),
			model: "claude-opus-5-5",
			usage: usage(7),
		});
	});

	it("skips assistant lines that do not carry usage", async () => {
		await write("s.jsonl", [
			JSON.stringify({
				type: "assistant",
				timestamp: "2026-10-01T00:00:00Z",
				message: { id: "m1", model: "claude-opus-5-5" },
			}),
		]);
		expect(await readClaudeMessages([root])).toEqual([]);
	});

	it("throws on an assistant line that is not JSON", async () => {
		await write("s.jsonl", ['{"type":"assistant",']);
		await expect(readClaudeMessages([root])).rejects.toThrow(SyntaxError);
	});

	it("keeps one message per id and request, the last one read", async () => {
		const at = "2026-10-01T00:00:00Z";
		await write("one/s.jsonl", [
			assistantLine({ id: "m1", at, requestId: "r1", input: 1 }),
			assistantLine({ id: "m1", at, requestId: "r1", input: 2 }),
			assistantLine({ id: "m1", at, requestId: "r2", input: 3 }),
		]);
		await write("two/s.jsonl", [
			assistantLine({ id: "m1", at, requestRef: "r2", input: 4 }),
			assistantLine({ id: "m2", at, input: 5 }),
			assistantLine({ id: "m2", at, input: 6 }),
		]);
		const messages = await readClaudeMessages([
			join(root, "one"),
			join(root, "two"),
		]);
		expect(messages.map((m) => m.usage.input_tokens)).toEqual([2, 4, 6]);
	});

	it("prefers requestRef over requestId as the request key", async () => {
		const at = "2026-10-01T00:00:00Z";
		await write("s.jsonl", [
			assistantLine({ id: "m1", at, requestId: "r1", requestRef: "x" }),
			assistantLine({ id: "m1", at, requestId: "r1", requestRef: "y" }),
		]);
		expect(await readClaudeMessages([root])).toHaveLength(2);
	});
});

describe("priceWindow", () => {
	// SAFETY: priceFor reads only family and the two token prices.
	const opus = {
		family: "claude-opus-5-5" as FamilyId,
		inputPricePerMTokUsd: 5,
		outputPricePerMTokUsd: 25,
	} as BenchmarkPoint;
	const sonnet = {
		family: "claude-sonnet-5-5" as FamilyId,
		inputPricePerMTokUsd: 3,
		outputPricePerMTokUsd: 15,
	} as BenchmarkPoint;

	const start: Mark = {
		at: "2026-10-01T00:00:00Z",
		plan: "claude-max-20x",
		usedPercent: 10,
		resetsAt: "2026-10-05T00:00:00Z",
		host: "devbox",
	};
	const end: Mark = { ...start, at: "2026-10-02T00:00:00Z", usedPercent: 30 };

	const message = (
		at: string,
		model: string,
		input: number,
	): ClaudeMessage => ({
		at: Date.parse(at),
		model,
		usage: usage(input),
	});

	it("sums API spend by family for messages inside the window", () => {
		const unpriced = new Set<string>();
		const sample = priceWindow(
			[start, end],
			[
				message("2026-09-30T23:59:59Z", "claude-opus-5-5", 1_000_000),
				message("2026-10-01T00:00:00Z", "claude-opus-5-5-20261001", 1_000_000),
				message("2026-10-01T12:00:00Z", "claude-opus-5-5", 2_000_000),
				message("2026-10-01T13:00:00Z", "claude-sonnet-5-5", 1_000_000),
				message("2026-10-02T00:00:00Z", "claude-opus-5-5", 1_000_000),
			],
			[opus, sonnet],
			unpriced,
		);
		expect(sample).toEqual({
			plan: "claude-max-20x",
			from: start.at,
			to: end.at,
			startUsedPercent: 10,
			endUsedPercent: 30,
			apiUsd: 18,
			apiUsdByFamily: { "claude-opus-5-5": 15, "claude-sonnet-5-5": 3 },
			host: "devbox",
		});
		expect(unpriced.size).toBe(0);
	});

	it("collects models it cannot price and leaves them out", () => {
		const unpriced = new Set<string>();
		const sample = priceWindow(
			[start, end],
			[
				message("2026-10-01T12:00:00Z", "mystery-model", 1_000_000),
				message("2026-10-01T12:00:00Z", "claude-opus-5-5", 1_000_000),
			],
			[opus],
			unpriced,
		);
		expect(sample.apiUsd).toBe(5);
		expect(sample.apiUsdByFamily).toEqual({ "claude-opus-5-5": 5 });
		expect([...unpriced]).toEqual(["mystery-model"]);
	});

	it("rethrows errors other than a missing price", () => {
		const messages = [
			{
				at: Date.parse("2026-10-01T12:00:00Z"),
				model: "claude-opus-5-5",
				usage: null,
			} as unknown as ClaudeMessage,
		];
		expect(() =>
			priceWindow([start, end], messages, [opus], new Set()),
		).toThrow(TypeError);
	});
});
