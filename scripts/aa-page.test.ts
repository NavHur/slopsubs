import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { loadAaEvalPages } from "./aa-page.ts";

afterEach(() => vi.unstubAllGlobals());

/** A fetch that answers every URL with `status` and a small page. */
function stubFetch(status: number): ReturnType<typeof vi.fn> {
	const fetchStub = vi.fn(
		async () => new Response("<html></html>", { status }),
	);
	vi.stubGlobal("fetch", fetchStub);
	return fetchStub;
}

describe("eval page loader", () => {
	it("returns each page's HTML on 200", async () => {
		stubFetch(200);
		const pages = await loadAaEvalPages([]);
		expect(pages.length).toBeGreaterThan(0);
		expect(pages.every((page) => page === "<html></html>")).toBe(true);
	});
	it("throws naming the URL on a non-200 status", async () => {
		stubFetch(404);
		await expect(loadAaEvalPages([])).rejects.toThrow(
			/^https:\/\/artificialanalysis\.ai\/evaluations\/.+: HTTP 404$/,
		);
	});
	it("throws on any other 2xx and on a redirect instead of following it", async () => {
		const fetchStub = stubFetch(203);
		await expect(loadAaEvalPages([])).rejects.toThrow("HTTP 203");
		stubFetch(301);
		await expect(loadAaEvalPages([])).rejects.toThrow("HTTP 301");
		expect(fetchStub).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ redirect: "manual" }),
		);
	});
});
