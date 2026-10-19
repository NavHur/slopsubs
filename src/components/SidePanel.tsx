import { useEffect, useRef } from "react";

/** Tailwind's `lg` breakpoint, where the sheet becomes the sidebar. */
const WIDE_QUERY = "(min-width: 64rem)";

/**
 * Calls `onClose` on Escape, or when the viewport widens past `lg`: the sheet
 * only exists below it, so the page must not stay inert or scroll-locked
 * behind the sidebar. Returns the cleanup.
 */
function listenForDismiss(onClose: () => void): () => void {
	const onKey = (event: KeyboardEvent) => {
		if (event.key === "Escape") onClose();
	};
	const wide = window.matchMedia(WIDE_QUERY);
	const onWide = () => {
		if (wide.matches) onClose();
	};
	onWide();
	window.addEventListener("keydown", onKey);
	wide.addEventListener("change", onWide);
	return () => {
		window.removeEventListener("keydown", onKey);
		wide.removeEventListener("change", onWide);
	};
}

/**
 * The sidebar on wide screens; below `lg` a full-screen sheet that opens
 * over the chart, like a native picker. The caller makes the rest of the
 * page `inert` while it is open.
 */
export function SidePanel({
	title,
	open,
	onClose,
	children,
}: {
	title: string;
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
}) {
	const doneRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		doneRef.current?.focus({ focusVisible: false });
		const { overflow } = document.body.style;
		document.body.style.overflow = "hidden";
		const stopListening = listenForDismiss(onClose);
		return () => {
			document.body.style.overflow = overflow;
			stopListening();
		};
	}, [open, onClose]);

	return (
		<aside
			aria-label={title}
			className={`border-line bg-bg lg:block lg:overflow-y-auto lg:border-l lg:px-5 lg:py-5 ${open ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:overflow-y-auto max-lg:overscroll-contain" : "max-lg:hidden"}`}
		>
			<div className="sticky top-0 z-10 flex h-[60px] items-center justify-between border-b border-line bg-bg px-4 lg:hidden">
				<h2 className="text-[17px] font-semibold">{title}</h2>
				<button
					ref={doneRef}
					type="button"
					onClick={onClose}
					className="-mr-2 min-h-11 px-2 text-[15px] font-medium text-accent"
				>
					Done
				</button>
			</div>
			<div className="space-y-8 px-4 py-5 lg:space-y-6 lg:p-0">{children}</div>
		</aside>
	);
}
