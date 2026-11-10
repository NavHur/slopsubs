import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { PointComparison } from "./PointComparison";

const family = "claude-opus-5-5" as FamilyId;

function pointWith(costPerTaskUsd: number): ValuePoint {
	return {
		seriesId: `${family}@api`,
		benchmark: {
			id: `${family}-max`,
			family,
			name: "Claude Opus 5.5",
			lab: "anthropic",
			labName: "Anthropic",
			deprecated: false,
			effort: "max",
			effortLabel: "max",
			effortOrder: 0,
			score: 45,
			costPerTaskUsd,
			tokensPerTask: 200000,
			secondsPerTask: 700,
			inputPricePerMTokUsd: 5,
			outputPricePerMTokUsd: 25,
		},
		score: 45,
		costPerTaskUsd,
		pricing: { kind: "api" },
	};
}

function render() {
	return renderToStaticMarkup(
		<PointComparison
			selected={pointWith(1000)}
			hovered={pointWith(1)}
			view={BENCHMARK_VIEWS.intelligence}
		/>,
	);
}

// Whether the table fits a phone is checked in a browser, against the build:
// `bun run check-comparison-fit`. These pin what that relies on.
describe("comparison table columns", () => {
	it("take their content's width, not fixed widths", () => {
		const html = render();
		expect(html).not.toContain("<col");
		expect(html).not.toContain("table-fixed");
	});

	it("keep figures and change chips on one line, and let labels and heads wrap", () => {
		const html = render();
		expect(html.match(/<td class="[^"]*whitespace-nowrap/g)).toHaveLength(8);
		const chip = html.match(/<span class="[^"]*rounded[^"]*">1000× cheaper/);
		expect(chip?.[0]).toContain("whitespace-nowrap");
		expect(html.match(/<th[^>]*whitespace-nowrap/g)).toBeNull();
	});
});

describe("score change chip", () => {
	function chipFor(selected: number, hovered: number): string {
		const html = renderToStaticMarkup(
			<PointComparison
				selected={{ ...pointWith(1), score: selected }}
				hovered={{ ...pointWith(1), score: hovered }}
				view={BENCHMARK_VIEWS.intelligence}
			/>,
		);
		const scoreRow = html.match(
			/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Score[\s\S]*?<\/tr>/,
		);
		if (!scoreRow) throw new Error("no Score row rendered");
		return scoreRow[0]
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	it("agrees with the shown figures when two different scores show alike", () => {
		expect(chipFor(23.06, 23.11)).toBe("Score 23.1 23.1 Same");
	});

	it("shows the tenth between two figures whose raw scores are 0.04 apart", () => {
		expect(chipFor(65.52, 65.558)).toBe("Score 65.5 65.6 +0.1 pts");
	});
});

describe("comparison column heads", () => {
	it("show the whole effort and pricing line, since a tooltip title cannot appear", () => {
		const html = renderToStaticMarkup(
			<PointComparison
				selected={pointWith(1000)}
				hovered={pointWith(1)}
				view={BENCHMARK_VIEWS.intelligence}
			/>,
		);
		const details = html.match(/<span class="[^"]*">max · API<\/span>/g);
		expect(details).toHaveLength(2);
		expect(details?.join("")).not.toContain("truncate");
		expect(html).not.toContain("title=");
	});
});
