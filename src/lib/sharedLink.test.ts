import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vite-plus/test";
import { PENDING_VIEW_SCRIPT } from "./sharedLink";

/** Runs the head script for a query string; whether it hid the prerender. */
function hidesPrerender(search: string): boolean {
	const dataset: Record<string, string> = {};
	runInNewContext(PENDING_VIEW_SCRIPT, {
		location: { search },
		document: { documentElement: { dataset } },
		URLSearchParams,
	});
	return "viewPending" in dataset;
}

describe("PENDING_VIEW_SCRIPT", () => {
	it("shows the prerender for a link that keeps the default drawing", () => {
		expect(hidesPrerender("")).toBe(false);
		expect(hidesPrerender("?chart=ranked-cost")).toBe(false);
		expect(hidesPrerender("?utm_source=newsletter")).toBe(false);
	});

	it("hides it for a link that sets any drawn param", () => {
		expect(hidesPrerender("?benchmark=omniscience")).toBe(true);
		expect(hidesPrerender("?chart=ranked-cost&scale=linear")).toBe(true);
		expect(hidesPrerender("?hideReasoning=%5B%5D")).toBe(true);
	});
});
