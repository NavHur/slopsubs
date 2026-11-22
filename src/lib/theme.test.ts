// @vitest-environment happy-dom
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { THEME_SCRIPT, toggleTheme } from "./theme";

afterEach(() => {
	delete document.documentElement.dataset.theme;
	vi.unstubAllGlobals();
});

describe("theme preference", () => {
	it.each(["light", "dark", "old-theme", null])(
		"decodes %s before first paint",
		(value) => {
			runInNewContext(THEME_SCRIPT, {
				document,
				localStorage: { getItem: () => value },
			});
			const expected = value === "old-theme" ? undefined : (value ?? undefined);
			expect(document.documentElement.dataset.theme).toBe(expected);
		},
	);

	it("still changes the theme when storage is blocked", () => {
		document.documentElement.dataset.theme = "light";
		vi.stubGlobal("localStorage", {
			setItem: () => {
				throw new DOMException("Storage denied", "SecurityError");
			},
		});
		toggleTheme();
		expect(document.documentElement.dataset.theme).toBe("dark");
	});
});
