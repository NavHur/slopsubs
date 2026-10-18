import { useState } from "react";
import { toggleTheme } from "#/lib/theme";

const HEADER_BUTTON =
	"grid h-11 place-items-center rounded-md text-muted transition-colors hover:text-fg disabled:opacity-40 disabled:hover:text-muted";

function Icon({ children }: { children: React.ReactNode }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="size-[18px]"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{children}
		</svg>
	);
}

export function ThemeToggle() {
	return (
		<button
			type="button"
			aria-label="Toggle light and dark theme"
			title="Toggle theme"
			onClick={toggleTheme}
			className={`${HEADER_BUTTON} w-11`}
		>
			<Icon>
				<circle cx="12" cy="12" r="4" />
				<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
			</Icon>
		</button>
	);
}

type ExportStatus = "idle" | "busy" | "failed";

const STATUS_TEXT: Record<ExportStatus, string> = {
	idle: "Download PNG",
	busy: "Exporting…",
	failed: "Export failed",
};

export function DownloadPngButton({
	disabled,
	onDownload,
}: {
	disabled: boolean;
	onDownload: () => Promise<void>;
}) {
	const [status, setStatus] = useState<ExportStatus>("idle");
	const download = async () => {
		setStatus("busy");
		try {
			await onDownload();
			setStatus("idle");
		} catch (error) {
			console.error("Chart export failed", error);
			setStatus("failed");
		}
	};
	return (
		<button
			type="button"
			disabled={disabled || status === "busy"}
			onClick={download}
			className={`${HEADER_BUTTON} grid-flow-col gap-2 px-2 text-[13px]`}
		>
			<Icon>
				<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
			</Icon>
			<span aria-live="polite">{STATUS_TEXT[status]}</span>
		</button>
	);
}
