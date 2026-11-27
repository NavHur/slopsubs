import { Effect, Schema } from "effect";
import type { Browser } from "playwright-core";
import { describe, expect, it, vi } from "vite-plus/test";
import { BrowserCheckError, browserRead, openBrowserPage } from "./browser.ts";

describe("browser effects", () => {
	it("releases a page when an interaction fails", async () => {
		const close = vi.fn(async () => {});
		const browser = { newPage: async () => ({ close }) } as unknown as Browser;
		const program = Effect.gen(function* () {
			yield* openBrowserPage(browser);
			return yield* new BrowserCheckError({ message: "interaction failed" });
		});
		await expect(
			Effect.runPromise(Effect.scoped(program)),
		).rejects.toMatchObject({
			_tag: "BrowserCheckError",
			message: "interaction failed",
		});
		expect(close).toHaveBeenCalledOnce();
	});

	it("fails before a malformed observation reaches the report", async () => {
		await expect(
			Effect.runPromise(browserRead(Schema.Int, "read count", async () => "4")),
		).rejects.toMatchObject({
			_tag: "SchemaError",
		});
	});

	it("keeps the browser rejection's cause", async () => {
		const cause = new Error("closed");
		await expect(
			Effect.runPromise(
				browserRead(Schema.Int, "read count", () => Promise.reject(cause)),
			),
		).rejects.toMatchObject({
			_tag: "BrowserOperationError",
			cause,
		});
	});
});
