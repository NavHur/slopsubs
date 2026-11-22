// @vitest-environment happy-dom
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { cachedFontDataUrl, FontAssets } from "./export-font";

describe("chart font", () => {
	it("retries a bad response and reuses the next successful conversion", async () => {
		const url = "/assets/test.woff2";
		let reads = 0;
		const download = cachedFontDataUrl(url).pipe(
			Effect.provideService(FontAssets, {
				read: () =>
					Effect.sync(() => {
						reads++;
						return new Blob([reads === 1 ? "<html>" : "wOF2font"], {
							type: "font/woff2",
						});
					}),
			}),
		);

		await expect(Effect.runPromise(download)).rejects.toMatchObject({
			_tag: "FontAssetError",
			message: `${url} is not a WOFF2 font`,
		});
		for (let i = 0; i < 2; i++)
			await expect(Effect.runPromise(download)).resolves.toBe(
				"data:font/woff2;base64,d09GMmZvbnQ=",
			);
		expect(reads).toBe(2);
	});
});
