import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { isPlainPrimaryClick, SectionNav } from "./SectionNav";

const plain = {
	button: 0,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	defaultPrevented: false,
};

describe("isPlainPrimaryClick", () => {
	it("handles an unmodified left click", () => {
		expect(isPlainPrimaryClick(plain)).toBe(true);
	});

	it.each([
		["ctrl", { ctrlKey: true }],
		["cmd", { metaKey: true }],
		["shift", { shiftKey: true }],
		["alt", { altKey: true }],
		["middle button", { button: 1 }],
		["already handled", { defaultPrevented: true }],
	])("leaves a %s click to the browser", (_name, change) => {
		expect(isPlainPrimaryClick({ ...plain, ...change })).toBe(false);
	});
});

describe("SectionNav", () => {
	it("links each section to the href the page gives it", () => {
		const html = renderToStaticMarkup(
			<SectionNav
				sections={[
					{ id: "a", label: "A" },
					{ id: "b", label: "B" },
				]}
				active="a"
				hrefFor={(id) => (id === "a" ? "/?scale=log" : `/?chart=${id}`)}
				onSelect={() => {}}
			/>,
		);
		expect(html).toContain('href="/?scale=log"');
		expect(html).toContain('href="/?chart=b"');
	});
});
