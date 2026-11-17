import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { FitSearch } from "#/lib/fit";
import type { QuestionScreen } from "#/lib/fitQuiz";
import { ViewSearch } from "#/lib/view";
import { PlanFitSection } from "./PlanFitSection";
import { QuizQuestion } from "./QuizQuestion";

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

/** A question on screen, as the section would hand it to QuizQuestion. */
function screen(
	index: number,
	draft: FitSearch,
	invalid: QuestionScreen["invalid"] = [],
): QuestionScreen {
	return { kind: "question", index, draft, invalid };
}

function questionHtml(question: QuestionScreen): string {
	return renderToStaticMarkup(
		<QuizQuestion
			screen={question}
			benchmarkName="Intelligence Index"
			backLabel="Back"
			onAnswer={() => {}}
			onEntry={() => {}}
			onBack={() => {}}
			onNext={() => {}}
		/>,
	);
}

describe("PlanFitSection", () => {
	it("opens on the quiz's first question when no answers are in the URL", () => {
		expect(text()).toContain("1 of 3 Which models do you use?");
		expect(text()).not.toContain("fits with");
	});

	it("opens a finished quiz's link on its result, with the answers above it", () => {
		// $250 a week of Opus against Pro's $342 weekly cap.
		const result = text({});
		expect(result).toContain(
			"Opus 5.5 · $250 of API usage a week · no budget Change answers",
		);
		expect(result).toContain("Claude Pro fits with 27% headroom.");
	});

	it("refers visitors who finish to LiteQuiz", () => {
		expect(text({})).toContain("Like this quiz? Build your own with LiteQuiz");
		expect(text()).not.toContain("LiteQuiz");
	});

	it("says when paying per token is cheaper", () => {
		expect(text({ amount: 2 })).toContain("Paying per token is cheaper");
	});

	it("respects Fable's half share on Claude Max", () => {
		const fable = text({ models: ["claude-fable-5-2"], amount: 500 });
		expect(fable).toContain("Claude Ultra fits with");
		expect(fable).toMatch(/Too small for this week Claude Max .* covered/);
		expect(fable).toContain("Doesn't include Fable 5.2: Claude Pro,");
	});

	it("sets aside a vendor's several plans under the vendor's name", () => {
		const opus = text({ amount: 250 });
		expect(opus).toContain("Codex (4 plans)");
		expect(opus).not.toContain("ChatGPT Pro 200");
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

	it("shows the split it counts when the shares don't add up to 100%", () => {
		const html = renderToStaticMarkup(
			<QuizQuestion
				screen={screen(0, {
					models: ["claude-opus-5-5", "claude-fable-5-2"],
					weights: { "claude-fable-5-2": 150 },
				})}
				benchmarkName="Intelligence Index"
				backLabel={null}
				onAnswer={() => {}}
				onEntry={() => {}}
				onBack={() => {}}
				onNext={() => {}}
			/>,
		);
		expect(html).toContain("Counted as Opus 5.5 25%, Fable 5.2 75%.");
	});

	it("tells a visitor why a field with no answer won't move on", () => {
		const usage = questionHtml(screen(1, {}, ["amount"]));
		expect(usage).toContain('aria-invalid="true"');
		expect(usage).toContain("Enter an amount above 0.");
		const budget = questionHtml(screen(2, {}, ["budget"]));
		expect(budget).toContain("A budget must be above $0.");
		expect(questionHtml(screen(2, {}))).not.toContain('aria-invalid="true"');
	});

	it("says how far short the closest plan falls", () => {
		expect(text({ amount: 5000 })).toMatch(
			/comes closest, at \d+% of it and \$[\d,]+ a month short\./,
		);
	});
});
