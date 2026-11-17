// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { type FitSearch, fitInputs } from "#/lib/fit";
import { PlanFitSection } from "./PlanFitSection";

afterEach(cleanup);

/**
 * The section as the index route mounts it: `fit` is the URL's param and
 * `onChange` the URL write. The test plays the router, handing back what was
 * written.
 */
function mountSection() {
	const onChange = vi.fn<(fit: FitSearch) => void>();
	const view = render(
		<PlanFitSection
			benchmark="intelligence"
			fit={undefined}
			onChange={onChange}
		/>,
	);
	const lastWritten = () => {
		const fit = onChange.mock.lastCall?.[0];
		if (!fit) throw new Error("The section has not written a fit yet");
		return fit;
	};
	/** The router applying the section's latest URL write. */
	const applyWrite = () =>
		view.rerender(
			<PlanFitSection
				benchmark="intelligence"
				fit={lastWritten()}
				onChange={onChange}
			/>,
		);
	return { onChange, applyWrite, lastWritten, user: userEvent.setup() };
}

const press = (name: string) => screen.getByRole("button", { name });
const amountField = () => screen.getByLabelText(/API-priced spend a week/);

describe("PlanFitSection, answered by a visitor", () => {
	it("writes the URL once, on finishing, and shows the ranked result for it", async () => {
		const { onChange, applyWrite, lastWritten, user } = mountSection();

		// 1. Models: Fable alone, in place of the starting Opus.
		await user.click(press("Fable 5.2"));
		await user.click(press("Opus 5.5"));
		expect(press("Fable 5.2").getAttribute("aria-pressed")).toBe("true");
		expect(press("Opus 5.5").getAttribute("aria-pressed")).toBe("false");
		await user.click(press("Next"));

		// 2. Usage: $500 of API spend a week.
		await user.clear(amountField());
		await user.type(amountField(), "500");
		await user.click(press("Next"));

		// 3. Budget: skipped. Nothing is in the URL until the quiz is done.
		expect(screen.getByText("3 of 3")).toBeTruthy();
		expect(onChange).not.toHaveBeenCalled();
		await user.click(press("See my plan"));

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(fitInputs(lastWritten())).toMatchObject({
			any: false,
			models: ["claude-fable-5-2"],
			unit: "apiUsd",
			amount: 500,
			budget: null,
		});

		// The URL write is what puts the result on screen.
		applyWrite();
		expect(screen.getByText(/Claude Ultra fits with/)).toBeTruthy();
		expect(
			screen.getByText("Fable 5.2 · $500 of API usage a week · no budget"),
		).toBeTruthy();
		expect(screen.queryByText("1 of 3")).toBeNull();
	});

	it("updates the URL and the result when an answer changes", async () => {
		const { onChange, applyWrite, lastWritten, user } = mountSection();

		// The starting answers, every question accepted as it opens.
		await user.click(press("Next"));
		await user.click(press("Next"));
		await user.click(press("See my plan"));
		expect(fitInputs(lastWritten())).toMatchObject({
			models: ["claude-opus-5-5"],
			amount: 250,
			budget: null,
		});
		applyWrite();
		expect(screen.getByText(/Claude Pro fits with/)).toBeTruthy();

		// Change answers: the quiz reopens on the answers given, URL untouched.
		await user.click(press("Change answers"));
		expect(onChange).toHaveBeenCalledTimes(1);
		await user.click(press("Next"));
		expect(amountField()).toHaveProperty("value", "250");
		await user.clear(amountField());
		await user.type(amountField(), "500");
		await user.click(press("Next"));
		await user.type(screen.getByLabelText(/Monthly budget/), "50");
		await user.click(press("See my plan"));

		expect(onChange).toHaveBeenCalledTimes(2);
		expect(fitInputs(lastWritten())).toMatchObject({ amount: 500, budget: 50 });

		applyWrite();
		expect(screen.getByText(/Over your budget:/)).toBeTruthy();
		expect(screen.queryByText(/Claude Pro fits with/)).toBeNull();
		expect(
			screen.getByText(
				"Opus 5.5 · $500 of API usage a week · up to $50 a month",
			),
		).toBeTruthy();
	});

	describe("a model share", () => {
		const shareField = (name: RegExp) =>
			screen.getByRole("spinbutton", { name });

		/** The models question with Opus and Fable both picked. */
		async function openShares() {
			const section = mountSection();
			await section.user.click(press("Fable 5.2"));
			return section;
		}

		it("takes a tiny share as typed and finishes with that weight", async () => {
			const { lastWritten, user } = await openShares();
			const fable = shareField(/Fable 5.2/);
			await user.clear(fable);
			await user.type(fable, "0.04");

			expect(fable).toHaveProperty("value", "0.04");
			expect(fable.getAttribute("aria-invalid")).toBeNull();
			expect(document.body.textContent).toContain("Fable 5.2 <1%");
			await user.click(press("Next"));
			await user.click(press("Next"));
			await user.click(press("See my plan"));
			expect(lastWritten().weights).toEqual({ "claude-fable-5-2": 0.04 });
		});

		it("keeps a typed 0 in sight, with the error, and blocks finishing", async () => {
			const { onChange, user } = await openShares();
			const fable = shareField(/Fable 5.2/);
			await user.clear(fable);
			await user.type(fable, "0");

			expect(fable).toHaveProperty("value", "0");
			expect(fable.getAttribute("aria-invalid")).toBe("true");
			expect(screen.getByRole("alert").textContent).toContain("above 0%");
			await user.click(press("Next"));
			expect(screen.getByText("1 of 3")).toBeTruthy();
			expect(onChange).not.toHaveBeenCalled();
		});
	});
});
