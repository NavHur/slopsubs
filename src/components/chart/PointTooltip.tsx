import type { ValuePoint } from "#/domain/value";
import { familyName } from "#/lib/families";
import { formatUsd } from "#/lib/format";

const TOOLTIP_HALF_WIDTH_PX = 120;
/** Room the tooltip needs above its point before it flips below. */
const TOOLTIP_FLIP_PX = 140;

export function PointTooltip({
	point,
	left,
	top,
	containerWidth,
}: {
	point: ValuePoint;
	left: number;
	top: number;
	containerWidth: number;
}) {
	const { benchmark, pricing } = point;
	const clampedLeft = Math.min(
		Math.max(left, TOOLTIP_HALF_WIDTH_PX),
		containerWidth - TOOLTIP_HALF_WIDTH_PX,
	);
	const below = top < TOOLTIP_FLIP_PX;
	return (
		<div
			className={`pointer-events-none absolute z-10 w-60 -translate-x-1/2 rounded-md border border-line bg-panel px-3 py-2 text-[12px] leading-5 shadow-[0_8px_24px_rgb(0_0_0/0.35)] ${below ? "translate-y-[14px]" : "-translate-y-[calc(100%+14px)]"}`}
			style={{ left: clampedLeft, top }}
		>
			<div className="font-semibold text-fg">
				{familyName(benchmark.family)}{" "}
				<span className="font-normal text-muted">
					· {benchmark.effortLabel}
				</span>
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
