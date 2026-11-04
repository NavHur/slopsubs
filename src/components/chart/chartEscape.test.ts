import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { closeFirstOpen, isChartEscape } from "./chartEscape";

describe("closeFirstOpen", () => {
	it("closes only the first open layer", () => {
		const closed: string[] = [];
		const layer = (name: string, open: boolean) => ({
			open,
			close: () => closed.push(name),
		});
		closeFirstOpen([layer("a", false), layer("b", true), layer("c", true)]);
		expect(closed).toEqual(["b"]);
	});
});

describe("isChartEscape", () => {
	// Node has no DOM; isTextEntryTarget only asks `instanceof HTMLElement`.
	beforeAll(() => vi.stubGlobal("HTMLElement", class {}));
	const chart = { closest: () => null } as unknown as HTMLElement;
	const inert = { closest: () => ({}) } as unknown as HTMLElement;

	it("takes Escape aimed at the chart", () => {
		expect(isChartEscape({ key: "Escape", target: null }, chart)).toBe(true);
	});

	it("leaves other keys and an inert chart alone", () => {
		expect(isChartEscape({ key: "a", target: null }, chart)).toBe(false);
		expect(isChartEscape({ key: "Escape", target: null }, inert)).toBe(false);
	});
});
