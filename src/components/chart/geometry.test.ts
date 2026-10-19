import { scaleLinear, scaleLog } from "d3-scale";
import { describe, expect, it } from "vitest";
import { chartLayout, tooltipPlacement, xTicks } from "./geometry";

const minGap = (ticks: number[], x: (t: number) => number) =>
	Math.min(...ticks.slice(1).map((t, i) => x(t) - x(ticks[i])));

describe("xTicks", () => {
	it("keeps every log tick when the axis is wide", () => {
		const x = scaleLog().domain([0.001, 10]).range([56, 760]);
		expect(xTicks(x, "log")).toEqual([
			0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10,
		]);
	});

	it("thins a narrow log axis to decades spaced apart", () => {
		const x = scaleLog().domain([0.001, 10]).range([36, 360]);
		const ticks = xTicks(x, "log");
		expect(ticks).toEqual([0.001, 0.01, 0.1, 1, 10]);
		expect(minGap(ticks, x)).toBeGreaterThanOrEqual(44);
	});

	it("asks a narrow linear axis for fewer ticks", () => {
		const x = scaleLinear().domain([0, 10]).range([36, 200]);
		expect(minGap(xTicks(x, "linear"), x)).toBeGreaterThanOrEqual(44);
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
