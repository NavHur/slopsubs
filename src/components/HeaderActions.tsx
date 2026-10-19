import { useEffect, useId, useRef, useState } from "react";
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

/**
 * Open state for a disclosure that closes on Escape (refocusing its trigger),
 * a press outside it, or focus leaving it.
 */
function useDisclosure() {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!open) return;
		const closeOutside = (event: Event) => {
			if (event.target instanceof Node && root.current?.contains(event.target))
				return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			// Stop at the document so the chart's window listener keeps its pin.
			event.stopPropagation();
			setOpen(false);
			trigger.current?.focus();
		};
		document.addEventListener("pointerdown", closeOutside);
		document.addEventListener("focusin", closeOutside);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", closeOutside);
			document.removeEventListener("focusin", closeOutside);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);
	return { open, setOpen, root, trigger };
}

/** The ⋯ menu of display preferences; for now, the line labels. */
export function ChartSettingsMenu({
	labels,
	onLabelsChange,
}: {
	labels: boolean;
	onLabelsChange: (labels: boolean) => void;
}) {
	const { open, setOpen, root, trigger } = useDisclosure();
	const panelId = useId();
	return (
		<div ref={root} className="relative">
			<button
				ref={trigger}
				type="button"
				aria-label="Chart settings"
				title="Chart settings"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen(!open)}
				className={`${HEADER_BUTTON} w-11`}
			>
				<Icon>
					<circle cx="5" cy="12" r="1" />
					<circle cx="12" cy="12" r="1" />
					<circle cx="19" cy="12" r="1" />
				</Icon>
			</button>
			<div
				id={panelId}
				hidden={!open}
				className="absolute top-full right-0 z-20 mt-1 w-48 rounded-md border border-line bg-panel px-3 py-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
			>
				<fieldset>
					<legend className="pb-1 text-[11px] text-subtle">Line chart</legend>
					<CheckButton
						label="Labels"
						checked={labels}
						onChange={onLabelsChange}
					/>
				</fieldset>
			</div>
		</div>
	);
}

/** A toggle row drawn as a checkbox, announced as a pressed button. */
function CheckButton({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={checked}
			onClick={() => onChange(!checked)}
			className="group flex min-h-8 w-full items-center gap-2 text-[13px] text-muted transition-colors hover:text-fg aria-pressed:text-fg"
		>
			<span className="grid size-3.5 place-items-center rounded-[3px] border border-subtle group-aria-pressed:border-accent group-aria-pressed:bg-accent">
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					className="size-2.5 stroke-bg opacity-0 group-aria-pressed:opacity-100"
					fill="none"
					strokeWidth={3.5}
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M20 6 9 17l-5-5" />
				</svg>
			</span>
			{label}
		</button>
	);
}
