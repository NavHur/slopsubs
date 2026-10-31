import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { familyName } from "#/lib/families";
import { FRONTIER_FAMILIES } from "#/lib/view";
import { FamilyList } from "./Sidebar";

const benchmarkName = BENCHMARK_VIEWS.frontiercode.tabLabel;
const [scored, unscored] = FRONTIER_FAMILIES;

function rows() {
	const html = renderToStaticMarkup(
		<FamilyList
			selected={[]}
			hiddenReasoning={[]}
			isDefault
			coverage={{ benchmarkName, scored: new Set([scored]) }}
			onSelect={() => {}}
			onHideReasoning={() => {}}
			onReset={() => {}}
		/>,
	);
	return html.split("<li>");
}

describe("FamilyList", () => {
	it("notes only the families with no score on the active benchmark", () => {
		const note = `No ${benchmarkName} score`;
		const rowOf = (family: typeof scored) =>
			rows().find((row) => row.includes(`>${familyName(family)}<`));
		expect(rowOf(unscored)).toContain(note);
		expect(rowOf(scored)).not.toContain(note);
	});
});
