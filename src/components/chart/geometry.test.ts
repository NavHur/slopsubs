import { scaleLinear, scaleLog } from "d3-scale";
import { describe, expect, it } from "vite-plus/test";
import { formatUsd } from "#/lib/format";
import {
	axisReadouts,
	chartLayout,
	MIN_TICK_LABEL_GAP_PX,
	overlaps,
	tooltipPlacement,
	xTickLabelBox,
	xTicks,
	yTickLabelBox,
} from "./geometry";

const axisLayout = chartLayout({ width: 1200, height: 620 }, { labels: true });

/** Smallest clear space between neighbouring tick labels' boxes. */
const minLabelGap = (ticks: number[], x: (t: number) => number) =>
	Math.min(
		...ticks.slice(1).map((t, i) => {
			const prev = xTickLabelBox(formatUsd(ticks[i]), x(ticks[i]), axisLayout);
			const next = xTickLabelBox(formatUsd(t), x(t), axisLayout);
			return next.left - (prev.left + prev.width);
		}),
	);

describe("xTicks", () => {
	it("keeps 1-2-5 log ticks when they have room", () => {
		const x = scaleLog().domain([0.001, 1]).range([56, 1020]);
		expect(xTicks(x, "log")).toEqual([
			0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1,
		]);
	});

	it("drops to 1-3 when 1-2-5 would crowd a desktop axis", () => {
		// A ~930px chart beside the label column, spanning five decades.
		const x = scaleLog().domain([0.0007, 70]).range([56, 750]);
		expect(xTicks(x, "log")).toEqual([
			0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30,
		]);
	});

	it("thins a narrow log axis to decades", () => {
		const x = scaleLog().domain([0.001, 10]).range([36, 360]);
		expect(xTicks(x, "log")).toEqual([0.001, 0.01, 0.1, 1, 10]);
	});

	it("skips decades when even those would crowd", () => {
		const x = scaleLog().domain([0.001, 100]).range([36, 220]);
		expect(xTicks(x, "log")).toEqual([0.001, 0.1, 10]);
	});

	it("labels a short log domain that holds no 1-2-5 tick", () => {
		// One plan at $0.003 gives a domain of 0.7× to 1.4× its cost.
		const x = scaleLog().domain([0.0021, 0.0042]).range([56, 1020]);
		const ticks = xTicks(x, "log");
		expect(ticks).toHaveLength(1);
		expect(ticks[0]).toBeGreaterThanOrEqual(0.0021);
		expect(ticks[0]).toBeLessThanOrEqual(0.0042);
	});

	it("labels a log domain that holds no 1, 2, 3 or 5 tick", () => {
		const x = scaleLog().domain([0.0036, 0.0048]).range([56, 1020]);
		const ticks = xTicks(x, "log");
		expect(ticks).toHaveLength(1);
		expect(ticks[0]).toBeGreaterThanOrEqual(0.0036);
		expect(ticks[0]).toBeLessThanOrEqual(0.0048);
	});

	it("falls back to one label when no tick count fits", () => {
		const x = scaleLinear().domain([0, 10]).range([36, 46]);
		expect(xTicks(x, "linear")).toHaveLength(1);
	});

	const widths = [220, 300, 360, 480, 640, 760, 930, 1200, 1600];
	const logDomains = [
		[0.0007, 0.02],
		[0.0007, 70],
		[0.003, 4],
		[0.02, 900],
		[0.5, 30],
	];
	const linearDomains = [
		[0, 0.03],
		[0, 1.5],
		[0, 70],
		[0, 1250],
	];
	it.each(widths)("never lets labels collide on a %ipx axis", (width) => {
		const axes = [
			...logDomains.map((d) => ({
				scale: "log" as const,
				x: scaleLog().domain(d),
			})),
			...linearDomains.map((d) => ({
				scale: "linear" as const,
				x: scaleLinear().domain(d),
			})),
		];
		for (const { scale, x } of axes) {
			x.range([36, width]);
			const ticks = xTicks(x, scale);
			const axis = `${scale} ${x.domain().join("–")} at ${width}px`;
			expect(ticks.length, axis).toBeGreaterThan(0);
			if (ticks.length > 1) {
				expect(
					minLabelGap(ticks, x),
					`${axis}: ${ticks.join(", ")}`,
				).toBeGreaterThanOrEqual(MIN_TICK_LABEL_GAP_PX);
			}
		}
	});
});

describe("chartLayout", () => {
	const labelled = { labels: true };

	it("moves labels to a legend on phone widths", () => {
		const phone = chartLayout({ width: 358, height: 0 }, labelled);
		const desktop = chartLayout({ width: 960, height: 700 }, labelled);
		expect([phone.compact, phone.endLabels]).toEqual([true, false]);
		expect([desktop.compact, desktop.endLabels]).toEqual([false, true]);
	});

	it("fills a tall container but never draws a squashed plot", () => {
		expect(chartLayout({ width: 960, height: 700 }, labelled).height).toBe(700);
		expect(chartLayout({ width: 960, height: 200 }, labelled).height).toBe(620);
	});

	it("gives the label column to the plot when labels are off", () => {
		const size = { width: 960, height: 700 };
		const on = chartLayout(size, labelled);
		const off = chartLayout(size, { labels: false });
		expect(off.endLabels).toBe(false);
		expect(off.margin.right).toBeLessThan(on.margin.right);
		expect({ ...off.margin, right: on.margin.right }).toEqual(on.margin);
	});

	it("keeps the phone layout whatever the labels setting", () => {
		const size = { width: 358, height: 0 };
		expect(chartLayout(size, { labels: false })).toEqual(
			chartLayout(size, labelled),
		);
	});
});

describe("tooltipPlacement", () => {
	const tooltip = { width: 256, height: 180 };
	const desktop = { width: 960, height: 620 };
	const phone = { width: 398, height: 457 };
	const covers = (
		{ left, top }: { left: number; top: number },
		point: { x: number; y: number },
	) =>
		point.x >= left &&
		point.x <= left + tooltip.width &&
		point.y >= top &&
		point.y <= top + tooltip.height;

	it("centres the tooltip above a point with room", () => {
		expect(tooltipPlacement({ x: 480, y: 400 }, tooltip, desktop)).toEqual({
			left: 352,
			top: 206,
		});
	});

	it("flips below a point near the top", () => {
		expect(tooltipPlacement({ x: 480, y: 60 }, tooltip, desktop).top).toBe(74);
	});

	it("keeps the tooltip inside the chart's sides", () => {
		const nearLeft = tooltipPlacement({ x: 20, y: 400 }, tooltip, phone);
		const nearRight = tooltipPlacement({ x: 390, y: 400 }, tooltip, phone);
		expect(nearLeft.left).toBe(8);
		expect(nearRight.left + tooltip.width).toBe(phone.width - 8);
	});

	it("never covers a phone point, wherever it sits", () => {
		for (let x = 36; x <= 386; x += 25) {
			for (let y = 28; y <= 409; y += 20) {
				const point = { x, y };
				const placement = tooltipPlacement(point, tooltip, phone);
				expect(covers(placement, point)).toBe(false);
				expect(placement.left).toBeGreaterThanOrEqual(0);
				expect(placement.left + tooltip.width).toBeLessThanOrEqual(phone.width);
			}
		}
	});

	it("sits beside the point when neither above nor below fits", () => {
		const short = { width: 960, height: 300 };
		expect(tooltipPlacement({ x: 300, y: 150 }, tooltip, short)).toEqual({
			left: 314,
			top: 60,
		});
	});

	it("spills out of a short, narrow chart rather than cover the point", () => {
		const tiny = { width: 320, height: 300 };
		const placement = tooltipPlacement({ x: 160, y: 200 }, tooltip, tiny);
		expect(placement.top).toBe(6);
		expect(covers(placement, { x: 160, y: 200 })).toBe(false);
	});
});

describe("axisReadouts", () => {
	const desktop = chartLayout({ width: 960, height: 620 }, { labels: true });
	const phone = chartLayout({ width: 398, height: 0 }, { labels: true });
	const text = { x: "$0.15", y: "57.6" };

	it("centres the cost readout under the point, in the tick row", () => {
		const { x } = axisReadouts({ x: 500, y: 200 }, text, desktop, 960);
		expect(x.left + x.width / 2).toBe(500);
		expect(overlaps(x, xTickLabelBox("$0.1", 500, desktop))).toBe(true);
	});

	it("sets the score readout level with the point, beside the plot", () => {
		const { y } = axisReadouts({ x: 500, y: 200 }, text, desktop, 960);
		expect(y.top + y.height / 2).toBe(200);
		expect(y.left + y.width).toBeLessThanOrEqual(desktop.margin.left);
	});

	it("returns the point's position for the guides and the tooltip", () => {
		const { at } = axisReadouts({ x: 500, y: 200 }, text, desktop, 960);
		expect(at).toEqual({ x: 500, y: 200 });
	});

	it("keeps both readouts inside a phone chart", () => {
		const nearLeft = axisReadouts({ x: 37, y: 30 }, text, phone, 398);
		const nearRight = axisReadouts({ x: 396, y: 30 }, text, phone, 398);
		expect(nearLeft.x.left).toBeGreaterThanOrEqual(0);
		expect(nearLeft.y.left).toBeGreaterThanOrEqual(0);
		expect(nearRight.x.left + nearRight.x.width).toBeLessThanOrEqual(398);
	});

	it("covers only the tick labels it lands on", () => {
		const { x, y } = axisReadouts({ x: 500, y: 200 }, text, desktop, 960);
		expect(overlaps(x, xTickLabelBox("$0.2", 530, desktop))).toBe(true);
		expect(overlaps(x, xTickLabelBox("$0.5", 600, desktop))).toBe(false);
		expect(overlaps(y, yTickLabelBox("55", 212, desktop))).toBe(true);
		expect(overlaps(y, yTickLabelBox("50", 279, desktop))).toBe(false);
	});
});
