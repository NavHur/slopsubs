import { useLayoutEffect, useRef, useState } from "react";
import type { ValuePoint } from "#/domain/value";
import { familyColor, familyLabId, familyName } from "#/lib/families";
import {
	formatApiComparison,
	formatIntelligence,
	formatTokens,
	formatUsd,
} from "#/lib/format";
import { ProviderLogo } from "../ProviderLogo";
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

/** Benchmark source pages, keyed by the benchmark's own id. */
const ARTIFICIAL_ANALYSIS_MODELS = "https://artificialanalysis.ai/models/";

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
			className={`${pinned ? "" : "pointer-events-none"} absolute z-10 w-64 max-w-[calc(100%-16px)] rounded-md border border-line bg-panel px-3 pt-1.5 pb-2.5 text-[12px] leading-5 shadow-[0_8px_24px_rgb(0_0_0/0.35)]`}
			style={placement ?? { left: 0, top: 0, visibility: "hidden" }}
		>
			<div className="flex min-h-7 items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-fg">
					<ProviderLogo lab={familyLabId(benchmark.family)} size={16} />
					<span
						className="truncate"
						style={{ color: familyColor(benchmark.family) }}
					>
						{familyName(benchmark.family)}
					</span>
				</div>
				{pinned && <CloseButton onClose={onClose} />}
			</div>
			<p className="text-muted">
				{benchmark.effortLabel} ·{" "}
				{pricing.kind === "api" ? "Pay per token (API)" : pricing.plan.label}
			</p>
			<dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
				<Metric
					label="Intelligence index"
					value={formatIntelligence(point.intelligence)}
				/>
				<Metric
					label={
						pricing.kind === "api" ? "Cost per task" : "Effective cost per task"
					}
					value={formatUsd(point.costPerTaskUsd)}
				/>
				{benchmark.tokensPerTask !== null && (
					<Metric
						label="Tokens per task"
						value={formatTokens(benchmark.tokensPerTask)}
					/>
				)}
			</dl>
			{pricing.kind === "plan" && (
				<p className="mt-2 border-t border-line pt-2">
					<span className="font-medium text-fg">
						{formatApiComparison(pricing.valueMultiple)}
					</span>{" "}
					<span className="text-muted tabular-nums">
						({formatUsd(point.costPerTaskUsd * pricing.valueMultiple)})
					</span>
				</p>
			)}
			<a
				href={`${ARTIFICIAL_ANALYSIS_MODELS}${benchmark.id}`}
				target="_blank"
				rel="noreferrer"
				className="mt-1.5 inline-block text-muted underline decoration-dotted underline-offset-2 hover:text-fg"
			>
				Artificial Analysis
			</a>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<>
			<dt className="text-muted">{label}</dt>
			<dd className="text-right text-fg">{value}</dd>
		</>
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
