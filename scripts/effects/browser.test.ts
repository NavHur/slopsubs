import { Effect, Schema } from "effect";
import type { Browser, Page, Route } from "playwright-core";
import { describe, expect, it, vi } from "vite-plus/test";
import {
	BrowserCheckError,
	browserOperation,
	browserRead,
	openBrowserPage,
	routeRequests,
} from "./browser.ts";

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
			_tag: "BrowserOperationError",
			operation: "read count",
			cause: { _tag: "SchemaError" },
		});
	});

	it("reports a failed route handler to the page's owner", async () => {
		let handler: (route: Route) => Promise<void> = async () => {};
		const page = {
			route: async (_url: string, run: typeof handler) => {
				handler = run;
			},
		} as unknown as Page;
		const cause = new Error("target closed");
		const route = {
			continue: () => Promise.reject(cause),
		} as unknown as Route;
		const program = Effect.gen(function* () {
			const failed = yield* routeRequests(page, "**/*.js", (route) =>
				browserOperation("continue", () => route.continue()),
			);
			yield* Effect.promise(() => handler(route));
			return yield* failed;
		});
		await expect(
			Effect.runPromise(Effect.scoped(program)),
		).rejects.toMatchObject({
			_tag: "BrowserOperationError",
			operation: "continue",
			cause,
		});
	});

	it("interrupts a sleeping route handler when its scope closes", async () => {
		let handler: (route: Route) => Promise<void> = async () => {};
		const page = {
			route: async (_url: string, run: typeof handler) => {
				handler = run;
			},
		} as unknown as Page;
		const proceed = vi.fn(async () => {});
		const route = { continue: proceed } as unknown as Route;
		const program = Effect.gen(function* () {
			yield* routeRequests(page, "**/*.js", (route) =>
				Effect.sleep("30 millis").pipe(
					Effect.andThen(browserOperation("continue", () => route.continue())),
				),
			);
			void handler(route).catch(() => {});
		});
		await Effect.runPromise(Effect.scoped(program));
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(proceed).not.toHaveBeenCalled();
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
