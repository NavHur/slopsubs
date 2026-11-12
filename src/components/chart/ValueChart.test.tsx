import { scaleLinear } from "d3-scale";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { leaderboards } from "#/data";
import type { ValuePoint } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { familyName } from "#/lib/families";
import { SeriesLine } from "./ChartParts";
import { markerPath } from "./geometry";
import { buildSeries } from "./series";
import { ValueChart } from "./ValueChart";

const size = vi.hoisted(() => ({ width: 960, height: 620 }));
vi.mock("./useChartRef", () => ({
	useChartRef: () => ({
		ref: () => {},
		element: { current: null },
		size,
	}),
}));

const point: ValuePoint = {
	seriesId: "example@api",
	score: 40,
	costPerTaskUsd: 1,
	benchmark: {
		...leaderboards.intelligence.models[0],
		score: 40,
		costPerTaskUsd: 1,
	},
	pricing: { kind: "api" },
};
const benchmark = BENCHMARK_VIEWS.intelligence;

function chart(points: ValuePoint[], labels = true, pareto = false) {
	return renderToStaticMarkup(
		<ValueChart
			points={points}
			scale="log"
			showPareto={pareto}
			showLabels={labels}
			benchmark={benchmark}
		/>,
	);
}

describe("ValueChart", () => {
	it("shows the empty-state message without plotting axes", () => {
		const html = chart([]);
		expect(html).toContain("Nothing to plot. Pick a model, or measure a plan.");
		expect(html).not.toContain("<svg");
	});
	it.each([390, 960])("names the model and benchmark at width %s", (width) => {
		size.width = width;
		const html = chart([point]);
		expect(html).toContain(`data-chart-width="${width}"`);
		expect(html).toContain("Effective cost per task versus Intelligence index");
		expect(html).toContain(familyName(point.benchmark.family));
	});
	it("omits desktop end labels when labels are disabled", () => {
		size.width = 960;
		expect(chart([point], false)).not.toContain(
			`>${familyName(point.benchmark.family)}<`,
		);
	});
	it("fades all but the frontier's points, and tags off it, while the Pareto line shows", () => {
		size.width = 960;
		const other = leaderboards.intelligence.models.find(
			(m) => m.family !== point.benchmark.family,
		);
		if (!other) throw new Error("fixture needs a second family");
		const pricier: ValuePoint = { ...point, score: 35, costPerTaskUsd: 3 };
		const dominated: ValuePoint = {
			...point,
			seriesId: `${other.family}@api`,
			score: 30,
			costPerTaskUsd: 2,
			benchmark: { ...other, score: 30, costPerTaskUsd: 2 },
		};
		const points = [point, pricier, dominated];
		const faded = (html: string) => html.match(/opacity="0\.(15|25)"/g) ?? [];
		expect(faded(chart(points, true, false))).toEqual([]);
		// Both lines and the two off-frontier points fade, then the dominated tag.
		expect(faded(chart(points, true, true))).toEqual([
			...Array(4).fill('opacity="0.15"'),
			'opacity="0.25"',
		]);
	});
});

describe("SeriesLine", () => {
	it.each([true, false])(
		"keeps marker style and selected size for API=%s",
		(isApi) => {
			const built = buildSeries([point])[0];
			const marker = isApi ? built.pricing.marker : "diamond";
			const series = {
				...built,
				pricing: { ...built.pricing, isApi, marker },
			} as typeof built;
			const x = scaleLinear().domain([0, 2]).range([0, 200]);
			const y = scaleLinear().domain([0, 80]).range([400, 0]);
			const html = renderToStaticMarkup(
				<SeriesLine
					series={series}
					x={x}
					y={y}
					shownPoints={[point]}
					emphasis={{ kind: "dimmed" }}
					onDetails={() => {}}
					benchmark={benchmark}
				/>,
			);
			expect(html).toContain('opacity="0.15"');
			expect(html).toContain('role="button" tabindex="0"');
			expect(html).toContain(
				`d="${markerPath(series.pricing.marker, x(1), y(40), 6)}"`,
			);
			expect(html).toContain(`fill="${isApi ? "var(--bg)" : series.color}"`);
			expect(html.includes('stroke-dasharray="3 4"')).toBe(isApi);
		},
	);
});
