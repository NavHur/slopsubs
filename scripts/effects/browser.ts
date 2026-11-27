import assert from "node:assert/strict";
import { Data, Deferred, Effect, FiberSet, Schema } from "effect";
import {
	chromium,
	type Browser,
	type LaunchOptions,
	type Page,
	type Route,
} from "playwright-core";
import { closeSite, originOf, serveSite } from "../serve-site.ts";

export class BrowserOperationError extends Data.TaggedError(
	"BrowserOperationError",
)<{
	operation: string;
	cause: unknown;
}> {
	override get message() {
		return `${this.operation}: ${String(this.cause)}`;
	}
}

export function browserOperation<A>(operation: string, run: () => Promise<A>) {
	return Effect.tryPromise({
		try: run,
		catch: (cause) => new BrowserOperationError({ operation, cause }),
	});
}

/** Values serialized out of Chromium cross a wire boundary. A value that does
 * not decode fails as the operation, with the SchemaError as its cause. */
export function browserRead<S extends Schema.Constraint>(
	schema: S,
	operation: string,
	run: () => Promise<unknown>,
) {
	return browserOperation(operation, run).pipe(
		Effect.flatMap((value) =>
			Schema.decodeUnknownEffect(schema)(value).pipe(
				Effect.mapError(
					(cause) => new BrowserOperationError({ operation, cause }),
				),
			),
		),
	);
}

/** Handlers run in the caller's scope, so closing it interrupts them. The
 * returned effect never succeeds and fails with the first handler failure. */
export const routeRequests = Effect.fnUntraced(function* (
	page: Page,
	url: Parameters<Page["route"]>[0],
	handle: (route: Route) => Effect.Effect<void, BrowserOperationError>,
) {
	const failed = yield* Deferred.make<never, BrowserOperationError>();
	const runHandler = yield* FiberSet.makeRuntimePromise();
	yield* browserOperation("route", () =>
		page.route(url, (route) =>
			runHandler(
				handle(route).pipe(
					Effect.catch((error) => Deferred.fail(failed, error)),
					Effect.asVoid,
				),
			),
		),
	);
	return Deferred.await(failed);
});

export const launchBrowser = (options?: LaunchOptions) =>
	Effect.acquireRelease(
		browserOperation("Launch Chromium", () => chromium.launch(options)),
		(browser) =>
			browserOperation("Close Chromium", () => browser.close()).pipe(
				Effect.orDie,
			),
	);

export const siteOrigin = (explicit?: string) =>
	explicit
		? Effect.succeed(explicit)
		: Effect.acquireRelease(serveSite, closeSite).pipe(
				Effect.flatMap(originOf),
			);

export function openBrowserPage(
	browser: Browser,
	options?: Parameters<Browser["newPage"]>[0],
) {
	return Effect.acquireRelease(
		browserOperation("Open browser page", () => browser.newPage(options)),
		(page) =>
			browserOperation("Close browser page", () => page.close()).pipe(
				Effect.orDie,
			),
	);
}

export class BrowserCheckError extends Data.TaggedError("BrowserCheckError")<{
	message: string;
	cause?: unknown;
}> {}

function browserCheck(check: () => void) {
	return Effect.try({
		try: check,
		catch: (cause) => new BrowserCheckError({ message: String(cause), cause }),
	});
}

export const checkTrue = (condition: unknown, message?: string) =>
	browserCheck(() => assert.ok(condition, message));
export const checkEqual = (actual: unknown, expected: unknown) =>
	browserCheck(() => assert.equal(actual, expected));
export const checkDeepEqual = (actual: unknown, expected: unknown) =>
	browserCheck(() => assert.deepEqual(actual, expected));
