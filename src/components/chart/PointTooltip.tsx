import { useLayoutEffect, useRef, useState } from "react";
import type { ValuePoint } from "#/domain/value";
import { familyName } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import { type Box, tooltipPlacement } from "./geometry";

/**
 * The element's border box, or null before its first layout. Measured after
 * every render, before paint, so new contents never show at the old spot.
 */
function useBorderBox<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [box, setBox] = useState<Box | null>(null);
	useLayoutEffect(() => {
		const node = ref.current;
		if (!node) return;
		const { offsetWidth: width, offsetHeight: height } = node;
		if (box?.width !== width || box?.height !== height) {
			setBox({ width, height });
		}
	});
	return [ref, box] as const;
}

/** Details of one point, placed beside it so it never covers it. */
export function PointTooltip({
	point,
	anchor,
	bounds,
	pinned,
	onClose,
}: {
	point: ValuePoint;
	/** The point's position in the chart. */
	anchor: { x: number; y: number };
	/** The chart's size; the tooltip stays inside it when it can. */
	bounds: Box;
	/** Pinned details take the pointer, for the close button and links. */
	pinned: boolean;
	onClose: () => void;
}) {
	const [ref, box] = useBorderBox<HTMLDivElement>();
	const { benchmark, pricing } = point;
	// Hidden for the one layout before its size is known.
	const placement = box && tooltipPlacement(anchor, box, bounds);
	return (
		<div
			ref={ref}
			className={`${pinned ? "" : "pointer-events-none"} absolute z-10 w-60 max-w-[calc(100%-16px)] rounded-md border border-line bg-panel px-3 py-2 text-[12px] leading-5 shadow-[0_8px_24px_rgb(0_0_0/0.35)]`}
			style={placement ?? { left: 0, top: 0, visibility: "hidden" }}
		>
			<div className="flex min-h-7 items-center justify-between gap-2">
				<div className="font-semibold text-fg">
					{familyName(benchmark.family)}{" "}
					<span className="font-normal text-muted">
						· {benchmark.effortLabel}
					</span>
				</div>
				{pinned && <CloseButton onClose={onClose} />}
			</div>
			<div className="text-muted">
				{pricing.kind === "api" ? "Pay per token (API)" : pricing.plan.label}
			</div>
			<dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
				<dt className="text-muted">Effective / task</dt>
				<dd className="text-right text-fg">
					{formatUsd(point.costPerTaskUsd)}
				</dd>
				{pricing.kind === "plan" && (
					<>
						<dt className="text-muted">API / task</dt>
						<dd className="text-right">
							{formatUsd(benchmark.costPerTaskUsd ?? 0)}
						</dd>
						<dt className="text-muted">Value multiple</dt>
						<dd className="text-right">{pricing.valueMultiple.toFixed(1)}×</dd>
					</>
				)}
				<dt className="text-muted">Intelligence</dt>
				<dd className="text-right">{point.intelligence.toFixed(1)}</dd>
			</dl>
		</div>
	);
}

function CloseButton({ onClose }: { onClose: () => void }) {
	return (
		<button
			type="button"
			aria-label="Close details"
			onClick={onClose}
			className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded text-muted hover:text-fg"
		>
			<svg
				width={14}
				height={14}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				aria-hidden="true"
			>
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	);
}
