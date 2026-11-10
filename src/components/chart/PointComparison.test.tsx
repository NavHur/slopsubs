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
/** Pixel width of the chip's longest text at 11px medium, with its padding. */
const CHIP_PX = "1,000× cheaper".length * 6 + 12;
const CELL_PADDING_PX = 8;
/** The narrowest table a phone card leaves: 100% − 16px card, less its padding. */
const PHONE_TABLE_PX = 303;

function columnClasses() {
	const html = renderToStaticMarkup(
		<PointComparison
			selected={pointWith(1000)}
			hovered={pointWith(1)}
			view={BENCHMARK_VIEWS.intelligence}
		/>,
	);
	return [...html.matchAll(/<col(?: class="([^"]*)")?\/>/g)].map(
		(m) => m[1] ?? "",
	);
}

describe("comparison table columns", () => {
	it("gives the change column room for its widest chip, not a share of the card", () => {
		const change = columnClasses().at(-1) ?? "";
		const rem = change.match(/^w-\[([\d.]+)rem\]$/);
		expect(rem, `change column is "${change}"`).not.toBeNull();
		const width = Number(rem?.[1]) * REM_PX;
		expect(width).toBeGreaterThanOrEqual(CHIP_PX + CELL_PADDING_PX);
	});

	it("still leaves the model columns room for a figure on a phone", () => {
		const [label, , , change] = columnClasses().map(
			(c) => Number(c.match(/([\d.]+)rem/)?.[1] ?? 0) * REM_PX,
		);
		const models = (PHONE_TABLE_PX - label - change) / 2;
		expect(models).toBeGreaterThanOrEqual(56);
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
