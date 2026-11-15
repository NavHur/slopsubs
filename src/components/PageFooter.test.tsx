import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { PageFooter } from "./PageFooter";

describe("PageFooter", () => {
	it("credits both Theo and Z.ai for the estimated caps", () => {
		const html = renderToStaticMarkup(
			<PageFooter
				benchmark={BENCHMARK_VIEWS.frontiercode}
				fetchedAt="2026-11-10T00:00:00Z"
			/>,
		);
		expect(html).toContain("estimated caps from");
		expect(html).toMatch(/>Theo<\/a>/);
		expect(html).toMatch(/href="https:\/\/docs\.z\.ai\/devpack\/overview"/);
	});
});
