import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { CodeOnlyFilter } from "./ModelFilters";

function checkbox(checked: boolean, applies: boolean) {
	const html = renderToStaticMarkup(
		<CodeOnlyFilter checked={checked} applies={applies} onChange={() => {}} />,
	);
	const input = html.match(/<input[^>]*>/)?.[0] ?? "";
	return {
		checked: input.includes("checked"),
		disabled: input.includes("disabled"),
		html,
	};
}

describe("CodeOnlyFilter", () => {
	it("follows the URL on a tab with a coding score to swap in", () => {
		expect(checkbox(false, true)).toMatchObject({
			checked: false,
			disabled: false,
		});
		expect(checkbox(true, true)).toMatchObject({
			checked: true,
			disabled: false,
		});
	});

	it("stays on, and says why, on a tab that scores coding already", () => {
		const fixed = checkbox(false, false);
		expect(fixed).toMatchObject({ checked: true, disabled: true });
		expect(fixed.html).toContain("FrontierCode scores coding already");
	});
});
