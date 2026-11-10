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

const REM_PX = 16;
/** Tabular digits at 12px DM Sans, per character. */
const FIGURE_CHAR_PX = 7.2;
/** The widest figure formatUsd, formatTokens and formatDuration produce: "11m 51s". */
const WIDEST_FIGURE_PX = 7 * FIGURE_CHAR_PX;
const CELL_PADDING_PX = 4;
/** Table widths at 320px, 375px and 390px viewports, and the 28rem desktop card. */
const TABLE_WIDTHS_PX = [246, 301, 316, 422];

function render() {
	return renderToStaticMarkup(
		<PointComparison
			selected={pointWith(1000)}
			hovered={pointWith(1)}
			view={BENCHMARK_VIEWS.intelligence}
		/>,
	);
}

function columnPx() {
	return [...render().matchAll(/<col(?: class="([^"]*)")?\/>/g)].map(
		(m) => Number(m[1]?.match(/([\d.]+)rem/)?.[1] ?? 0) * REM_PX,
	);
}

describe("comparison table columns", () => {
	it.each(TABLE_WIDTHS_PX)(
		"leave each figure column room for the widest figure in a %ipx table",
		(table) => {
			const [label, , , change] = columnPx();
			const figure = (table - label - change) / 2;
			expect(figure).toBeGreaterThanOrEqual(WIDEST_FIGURE_PX + CELL_PADDING_PX);
		},
	);

	it("lets names, labels and chips wrap, and keeps figures on one line", () => {
		const html = render();
		expect(html).not.toMatch(/class="[^"]*truncate[^"]*"/);
		expect(html).toMatch(/class="[^"]*break-words[^"]*">Opus 5.5/);
		const chip = html.match(/<span class="[^"]*rounded[^"]*"/)?.[0] ?? "";
		expect(chip).not.toContain("whitespace-nowrap");
		expect(html.match(/<td class="[^"]*whitespace-nowrap/g)).toHaveLength(8);
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
