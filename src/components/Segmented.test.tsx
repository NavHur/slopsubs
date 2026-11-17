import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { Segmented } from "./Segmented";

const options = [
	{ value: "a", label: "A" },
	{ value: "b", label: "B" },
] as const;

function fieldset(wrap?: boolean): string {
	const html = renderToStaticMarkup(
		<Segmented
			label="Choice"
			options={options}
			value="a"
			onChange={() => {}}
			wrap={wrap}
		/>,
	);
	return html.match(/<fieldset[^>]*>/)?.[0] ?? "";
}

describe("Segmented", () => {
	it("keeps its options in one row, as a scroll row needs", () => {
		expect(fieldset()).not.toContain("flex-wrap");
	});

	it("wraps its options onto more rows when asked", () => {
		expect(fieldset(true)).toContain("flex-wrap");
	});
});
