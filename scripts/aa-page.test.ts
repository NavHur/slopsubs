import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { describe, expect, it, vi } from "vite-plus/test";
import { loadAaEvalPages } from "./aa-page.ts";
import { TextFiles } from "./effects/files.ts";

function fetchEvalPages(status: number) {
	const fetch = vi.fn<typeof globalThis.fetch>(
		async () => new Response("<html></html>", { status }),
	);
	const pages = Effect.runPromise(
		loadAaEvalPages([]).pipe(
			Effect.provide(Layer.mergeAll(TextFiles.layer, FetchHttpClient.layer)),
			Effect.provideService(FetchHttpClient.Fetch, fetch),
		),
	);
	return { pages, fetch };
}

describe("eval page loader", () => {
	it("returns each page's HTML on 200", async () => {
		const pages = await fetchEvalPages(200).pages;
		expect(pages.length).toBeGreaterThan(0);
		expect(pages.every((page) => page === "<html></html>")).toBe(true);
	});
	it("throws naming the URL on a non-200 status", async () => {
		await expect(fetchEvalPages(404).pages).rejects.toThrow(
			/^https:\/\/artificialanalysis\.ai\/evaluations\/.+: HTTP 404$/,
		);
	});
	it("throws on any other 2xx and on a redirect instead of following it", async () => {
		await expect(fetchEvalPages(203).pages).rejects.toThrow("HTTP 203");
		const { pages, fetch } = fetchEvalPages(301);
		await expect(pages).rejects.toThrow("HTTP 301");
		expect(fetch).toHaveBeenCalledWith(
			expect.any(URL),
			expect.objectContaining({ redirect: "manual" }),
		);
	});
});
