import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ModelTag } from "./ChartParts";
import type { ModelGroup } from "./series";

// Node has no DOM: call ModelTag as a function, with its effect made inert.
vi.mock("react", async (importOriginal) => ({
	...(await importOriginal<typeof import("react")>()),
	useEffect: () => {},
}));

describe("ModelTag press", () => {
	it("keeps a press on the label from starting a camera turn", () => {
		const model = {
			id: "gpt",
			name: "GPT",
			color: "red",
		} as unknown as ModelGroup;
		const tag = ModelTag({
			model,
			from: [0, 0],
			at: [10, 10],
			dimmed: false,
			pinned: false,
			onHighlight: () => {},
		}) as ReactElement<{
			onPointerDown?: (event: { stopPropagation: () => void }) => void;
		}>;
		const stopPropagation = vi.fn();
		tag.props.onPointerDown?.({ stopPropagation });
		expect(stopPropagation).toHaveBeenCalledOnce();
	});
});
