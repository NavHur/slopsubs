import type { ReactNode } from "react";
import { DownloadPngButton } from "./HeaderActions";

/**
 * One chart on the page: an anchor the section nav scrolls to, its title,
 * its controls and its own PNG download (hidden on phones, which share
 * links instead).
 */
export function ChartSection({
	id,
	title,
	controls,
	canExport,
	onExport,
	className = "",
	children,
}: {
	id: string;
	title: string;
	controls?: ReactNode;
	canExport: boolean;
	onExport: () => Promise<void>;
	className?: string;
	children: ReactNode;
}) {
	const titleId = `${id}-title`;
	return (
		<section
			id={id}
			aria-labelledby={titleId}
			className={`flex scroll-mt-24 flex-col sm:scroll-mt-12 border-line px-4 pt-5 pb-6 not-first:border-t sm:px-7 ${className}`}
		>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
				<h2
					id={titleId}
					tabIndex={-1}
					className="text-[17px] font-semibold outline-none"
				>
					{title}
				</h2>
				<div className="flex items-center gap-x-6 max-sm:w-full max-sm:justify-between">
					{controls}
					<div className="-mr-2 max-sm:hidden">
						<DownloadPngButton disabled={!canExport} onDownload={onExport} />
					</div>
				</div>
			</div>
			{children}
		</section>
	);
}
