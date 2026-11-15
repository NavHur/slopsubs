import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { FitSearch } from "#/lib/fit";
import { ViewSearch } from "#/lib/view";
import { PlanFitSection } from "./PlanFitSection";

/** The section's text for a `fit` param, parsed the way the page parses it. */
function text(fit?: unknown): string {
	const parsed = ViewSearch.parse(fit === undefined ? {} : { fit }).fit;
	const html = renderToStaticMarkup(
		<PlanFitSection
			benchmark="intelligence"
			fit={parsed satisfies FitSearch | undefined}
			onChange={() => {}}
		/>,
	);
	return html
		.replace(/<[^>]+>/g, " ")
		.replaceAll("&#x27;", "'")
		.replace(/\s+/g, " ");
}

describe("PlanFitSection", () => {
	it("answers on first paint with the cheapest plan that fits", () => {
		// $250 a week of Opus against Pro's $342 weekly cap.
		expect(text()).toContain("Claude Pro fits with 27% headroom.");
	});

	it("says when paying per token is cheaper", () => {
		expect(text({ amount: 2 })).toContain("Paying per token is cheaper");
	});

	it("respects Fable's half share on Claude Max", () => {
		const fable = text({ models: ["claude-fable-5-2"], amount: 500 });
		expect(fable).toContain("Claude Ultra fits with");
		expect(fable).toMatch(/Too small for this week Claude Max .* covered/);
		expect(fable).toContain("Doesn't include Fable 5.2: Claude Pro");
	});

	it("says when no single plan covers the week", () => {
		expect(text({ amount: 5000 })).toContain(
			"No single plan covers this week. Claude Ultra comes closest",
		);
	});

	it("won't price tasks at an effort the benchmark didn't run", () => {
		expect(
			text({ models: ["gemini-4-argon"], unit: "tasks", effort: "max" }),
		).toContain("has no max-effort cost for Gemini 4 Argon");
	});

	it("hides plans over the budget", () => {
		const capped = text({ amount: 500, budget: 50 });
		expect(capped).toContain("Over your budget:");
		expect(capped).not.toContain("Claude Max fits");
	});
});
