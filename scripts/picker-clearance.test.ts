import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { readPickerClearance } from "./picker-clearance.ts";

afterEach(() => vi.unstubAllGlobals());

function picker(scrollLeft: number, left: number, right: number) {
	const row = {
		scrollLeft,
		scrollWidth: 600,
		clientWidth: 300,
		getBoundingClientRect: () => ({ left: 10, right: 310 }),
	};
	vi.stubGlobal("document", {
		querySelector: () => ({
			parentElement: row,
			querySelector: () => ({ getBoundingClientRect: () => ({ left, right }) }),
		}),
	});
	return readPickerClearance({ picker: "fieldset", fade: 24, slack: 2 });
}

describe("picker clearance", () => {
	it.each([
		[0, 10, 110, 0],
		[100, 34, 286, 0],
		[300, 210, 310, 0],
		[100, 20, 100, -14],
		[100, 100, 300, -14],
		[2, 10, 100, 0],
		[298, 210, 310, 0],
	])(
		"measures the unfaded band at scroll %s",
		(scroll, left, right, expected) => {
			expect(picker(scroll, left, right)).toBe(expected);
		},
	);
	it("rejects a missing picker", () => {
		vi.stubGlobal("document", { querySelector: () => null });
		expect(() =>
			readPickerClearance({ picker: "fieldset", fade: 24, slack: 2 }),
		).toThrow("No benchmark picker");
	});
});
