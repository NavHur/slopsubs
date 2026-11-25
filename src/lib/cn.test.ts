import { readFileSync } from "node:fs";
import { cn } from "cn";
import { describe, expect, it } from "vite-plus/test";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** Every `--color-<name>` token the `@theme` block defines. */
const colorTokens = [...css.matchAll(/--color-([\w-]+):/g)].map(
	(match) => match[1],
);

describe("cn", () => {
	it("keeps the later of two conflicting utilities", () => {
		expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
		expect(cn("w-64", "w-[28rem]")).toBe("w-[28rem]");
		expect(cn("cursor-grab", "cursor-grabbing")).toBe("cursor-grabbing");
	});

	it("lets a caller className override the component's defaults", () => {
		const base = "text-[13px] text-muted";
		expect(cn(base, "text-fg")).toBe("text-[13px] text-fg");
		expect(cn(base, "text-[12px]")).toBe("text-muted text-[12px]");
	});

	it("drops falsy conditions and joins the rest", () => {
		const off = false as boolean;
		expect(cn("flex", off && "hidden", undefined, null, "", "gap-2")).toBe(
			"flex gap-2",
		);
	});

	it("resolves conflicts per variant", () => {
		expect(cn("max-lg:text-[15px] text-muted", "max-lg:text-[14px]")).toBe(
			"text-muted max-lg:text-[14px]",
		);
		expect(cn("hover:text-fg", "hover:text-muted")).toBe("hover:text-muted");
		expect(cn("text-fg", "hover:text-muted")).toBe("text-fg hover:text-muted");
	});

	it("reads every @theme colour token as a colour", () => {
		expect(colorTokens).toContain("muted");
		for (const token of colorTokens) {
			expect(cn("text-[13px]", `text-${token}`)).toBe(
				`text-[13px] text-${token}`,
			);
			expect(cn("text-xs", `text-${token}`)).toBe(`text-xs text-${token}`);
			expect(cn("text-fg", `text-${token}`)).toBe(`text-${token}`);
			expect(cn("bg-bg", `bg-${token}`)).toBe(`bg-${token}`);
			expect(cn("border-line", `border-${token}`)).toBe(`border-${token}`);
			expect(cn("bg-fg/70", `bg-${token}`)).toBe(`bg-${token}`);
		}
	});

	it("keeps a theme colour apart from the size or width it sits beside", () => {
		expect(cn("border border-line", "border-worse")).toBe(
			"border border-worse",
		);
		expect(cn("border-line", "border-t")).toBe("border-line border-t");
		expect(cn("text-muted", "text-[13px]")).toBe("text-muted text-[13px]");
	});

	it("keeps the theme font beside a weight", () => {
		expect(cn("font-sans", "font-medium")).toBe("font-sans font-medium");
		expect(cn("font-sans font-medium", "font-bold")).toBe(
			"font-sans font-bold",
		);
	});
});
