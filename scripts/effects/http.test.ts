import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { describe, expect, it, vi } from "vite-plus/test";
import { getText } from "./http.ts";

const URL = "https://example.com/eval";

describe("import HTTP client", () => {
	it("reports a redirect as a failed eval page", async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(
			async () =>
				new Response(null, {
					status: 302,
					headers: { location: "/renamed" },
				}),
		);
		await expect(
			Effect.runPromise(
				getText(URL, { rejectRedirects: true }).pipe(
					Effect.provide(FetchHttpClient.layer),
					Effect.provideService(FetchHttpClient.Fetch, fetch),
				),
			),
		).rejects.toMatchObject({
			_tag: "RemoteStatusError",
			status: 302,
			url: URL,
		});
		expect(fetch).toHaveBeenCalledWith(
			expect.any(globalThis.URL),
			expect.objectContaining({ redirect: "manual" }),
		);
	});

	it("reads the successful response body", async () => {
		const fetch: typeof globalThis.fetch = async () =>
			new Response("<html>page</html>");
		await expect(
			Effect.runPromise(
				getText(URL).pipe(
					Effect.provide(FetchHttpClient.layer),
					Effect.provideService(FetchHttpClient.Fetch, fetch),
				),
			),
		).resolves.toBe("<html>page</html>");
	});
});
