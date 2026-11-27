// @vitest-environment happy-dom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ChartExportError } from "#/lib/chart-export";
import { DownloadPngButton } from "./HeaderActions";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("DownloadPngButton", () => {
	it("disables the button while the effect is running and restores it on success", async () => {
		let finish!: () => void;
		const pending = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const exportChart = vi.fn(() => Effect.promise(() => pending));
		render(<DownloadPngButton disabled={false} onDownload={exportChart} />);
		fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
		const busy = screen.getByRole("button", { name: "Exporting…" });
		expect((busy as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(busy);
		expect(exportChart).toHaveBeenCalledOnce();
		finish();
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Download PNG" }),
			).toBeDefined(),
		);
	});

	it("reports a typed export failure and permits another attempt", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const exportChart = vi
			.fn()
			.mockReturnValueOnce(
				Effect.fail(new ChartExportError({ message: "PNG encoding failed" })),
			)
			.mockReturnValueOnce(Effect.void);
		render(<DownloadPngButton disabled={false} onDownload={exportChart} />);
		fireEvent.click(screen.getByRole("button", { name: "Download PNG" }));
		const retry = await screen.findByRole("button", { name: "Export failed" });
		expect((retry as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(retry);
		await screen.findByRole("button", { name: "Download PNG" });
		expect(exportChart).toHaveBeenCalledTimes(2);
	});
});
