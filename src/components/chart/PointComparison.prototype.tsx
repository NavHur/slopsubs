// PROTOTYPE, throwaway: four alternatives to the comparison tooltip, picked
// with `?variant=` (A current, B columns, C verdict, D bars, E deltas) or the
// floating switcher. Lives on pedro/prototype-comparison-header only.
import { type ComponentType, useSyncExternalStore } from "react";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { familyColor, familyName } from "#/lib/families";
import { ColorDot } from "./ColorDot";
import {
	type Change,
	changeOf,
	comparisonRows,
	MISSING,
	PointIdentity,
	type Row,
	TONE_CLASS,
} from "./PointComparison";

export const VARIANTS = [
	{ key: "A", name: "Current: header above table" },
	{ key: "B", name: "Columns: models head the table" },
	{ key: "C", name: "Verdict first" },
	{ key: "D", name: "Bars: diverging change" },
	{ key: "E", name: "Deltas on the hovered card" },
] as const;
export type VariantKey = (typeof VARIANTS)[number]["key"];

const listeners = new Set<() => void>();
let current: VariantKey = readUrl();

function readUrl(): VariantKey {
	if (typeof window === "undefined") return "A";
	const raw = new URLSearchParams(window.location.search).get("variant");
	return VARIANTS.find((v) => v.key === raw)?.key ?? "A";
}

export function setVariant(key: VariantKey) {
	current = key;
	const url = new URL(window.location.href);
	url.searchParams.set("variant", key);
	window.history.replaceState(window.history.state, "", url);
	for (const l of listeners) l();
}

export function useVariant(): VariantKey {
	return useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => current,
		() => "A",
	);
}

type Props = { selected: ValuePoint; hovered: ValuePoint; view: BenchmarkView };

export function PrototypeComparison({
	Current,
	...props
}: Props & { Current: ComponentType<Props> }) {
	const variant = useVariant();
	const Variant = {
		A: Current,
		B: ColumnsVariant,
		C: VerdictVariant,
		D: BarsVariant,
		E: DeltasVariant,
	}[variant];
	return <Variant {...props} />;
}

type Figure = { row: Row; a: number | null; b: number | null; change: Change };

function figures({ selected, hovered, view }: Props): Figure[] {
	return comparisonRows([selected, hovered], view)
		.map((row) => {
			const a = row.value(selected);
			const b = row.value(hovered);
			return { row, a, b, change: changeOf(row, b, a) };
		})
		.filter((f) => f.a !== null || f.b !== null);
}

const shown = (f: Figure, value: number | null) =>
	value === null ? MISSING : f.row.format(value);

const pricingName = (p: ValuePoint) =>
	p.pricing.kind === "api" ? "API" : p.pricing.plan.label;

const SHORT_LABEL = ["Score", "Cost", "Tokens", "Time"];

/** B: no header; each model heads its own column, name over effort. */
function ColumnsVariant(props: Props) {
	const { selected, hovered } = props;
	return (
		<table className="mt-1 w-full table-fixed tabular-nums">
			<colgroup>
				<col className="w-[19%]" />
				<col />
				<col />
				<col className="w-[23%]" />
			</colgroup>
			<thead>
				<tr className="border-b border-line align-bottom">
					<th scope="col" className="sr-only">
						Figure
					</th>
					<ModelHead point={selected} side="Selected" />
					<ModelHead point={hovered} side="Hovered" />
					<th
						scope="col"
						className="pb-1 pl-2 text-right text-[11px] font-normal text-subtle"
					>
						Change
					</th>
				</tr>
			</thead>
			<tbody>
				{figures(props).map((f, i) => (
					<tr key={f.row.label}>
						<th
							scope="row"
							className="truncate pt-0.5 text-left font-normal text-muted"
						>
							{SHORT_LABEL[i] ?? f.row.label}
						</th>
						<td className="pt-0.5 pl-2 text-right text-fg">{shown(f, f.a)}</td>
						<td className="pt-0.5 pl-2 text-right text-fg">{shown(f, f.b)}</td>
						<td
							className={`pt-0.5 pl-2 text-right font-medium whitespace-nowrap ${TONE_CLASS[f.change.tone]}`}
						>
							{f.change.text}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function ModelHead({ point, side }: { point: ValuePoint; side: string }) {
	const { family, effortLabel } = point.benchmark;
	return (
		<th scope="col" className="min-w-0 pb-1 pl-2 text-right font-normal">
			<span className="sr-only">{side}: </span>
			<span className="flex items-center justify-end gap-1 text-[12px] font-semibold text-fg">
				<ColorDot color={familyColor(family)} />
				<span className="truncate">{familyName(family)}</span>
			</span>
			<span className="block truncate text-[11px] text-muted">
				{effortLabel} · {pricingName(point)}
			</span>
		</th>
	);
}

/** One line that answers "is the hovered point worth it?". */
function verdict(fs: readonly Figure[]): {
	text: string;
	tone: Change["tone"];
} {
	const known = fs.filter((f) => f.change.text !== MISSING);
	if (known.every((f) => f.change.tone === "better"))
		return { text: "Better on every figure", tone: "better" };
	if (known.every((f) => f.change.tone === "worse"))
		return { text: "Worse on every figure", tone: "worse" };
	const [score, cost] = fs;
	if (!score || !cost) return { text: "Mixed", tone: "same" };
	const joiner = score.change.tone === cost.change.tone ? "and" : "but";
	return {
		text: `${score.change.text} ${joiner} ${cost.change.text}`,
		tone: "same",
	};
}

/** C: a verdict, then each change large with the raw figures beneath. */
function VerdictVariant(props: Props) {
	const { selected, hovered } = props;
	const fs = figures(props);
	const v = verdict(fs);
	return (
		<>
			<p className="flex min-h-7 items-center gap-1.5 text-muted">
				<Who point={hovered} strong />
				<span>vs</span>
				<Who point={selected} />
			</p>
			<p
				className={`text-[15px] font-semibold ${v.tone === "same" ? "text-fg" : TONE_CLASS[v.tone]}`}
			>
				{v.text}
			</p>
			<dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-2 tabular-nums">
				{fs.map((f) => (
					<div key={f.row.label} className="min-w-0">
						<dt className="truncate text-[11px] text-subtle">{f.row.label}</dt>
						<dd
							className={`text-[14px] font-semibold ${TONE_CLASS[f.change.tone]}`}
						>
							{f.change.text}
						</dd>
						<dd className="text-[11px] text-muted">
							{shown(f, f.a)} → {shown(f, f.b)}
						</dd>
					</div>
				))}
			</dl>
		</>
	);
}

function Who({
	point,
	strong = false,
}: {
	point: ValuePoint;
	strong?: boolean;
}) {
	const { family, effortLabel } = point.benchmark;
	return (
		<span className="inline-flex min-w-0 items-center gap-1">
			<ColorDot color={familyColor(family)} />
			<span className={`truncate ${strong ? "font-semibold text-fg" : ""}`}>
				{familyName(family)} {effortLabel}
			</span>
		</span>
	);
}

/** How far a change reaches from the centre line, 0 to 1. */
function reach(f: Figure): number {
	if (f.a === null || f.b === null || f.change.tone === "same") return 0;
	const isScore = f.change.text.endsWith("pts");
	if (isScore) return Math.min(Math.abs(f.b - f.a) / 15, 1);
	if (f.a <= 0 || f.b <= 0) return 0;
	return Math.min(Math.abs(Math.log10(f.b / f.a)) / 2, 1);
}

/** D: one-line header, then a diverging bar per figure. */
function BarsVariant(props: Props) {
	const { selected, hovered } = props;
	return (
		<>
			<p className="flex min-h-7 items-center gap-1.5 text-[12px] text-muted">
				<Who point={selected} />
				<span aria-hidden="true">→</span>
				<Who point={hovered} strong />
			</p>
			<div className="mt-1 flex justify-between text-[10px] tracking-wide text-subtle uppercase">
				<span>Worse</span>
				<span>Better</span>
			</div>
			<ul className="mt-0.5 space-y-1.5 tabular-nums">
				{figures(props).map((f) => {
					const r = reach(f);
					const better = f.change.tone === "better";
					return (
						<li key={f.row.label}>
							<div className="flex justify-between gap-2">
								<span className="truncate text-muted">{f.row.label}</span>
								<span
									className={`font-medium whitespace-nowrap ${TONE_CLASS[f.change.tone]}`}
								>
									{f.change.text}
								</span>
							</div>
							<div className="relative mt-0.5 h-1.5 rounded-full bg-line">
								<span className="absolute top-[-2px] left-1/2 h-2.5 w-px bg-grid" />
								<span
									className={`absolute top-0 h-1.5 rounded-full ${better ? "bg-better" : "bg-worse"}`}
									style={{
										width: `${Math.max(r * 50, f.change.tone === "same" ? 0 : 2)}%`,
										...(better ? { left: "50%" } : { right: "50%" }),
									}}
								/>
							</div>
							<div className="flex justify-between text-[11px] text-subtle">
								<span>{shown(f, f.a)}</span>
								<span>{shown(f, f.b)}</span>
							</div>
						</li>
					);
				})}
			</ul>
		</>
	);
}

/** E: the hovered point's usual card, each figure carrying its delta. */
function DeltasVariant(props: Props) {
	const { selected, hovered } = props;
	return (
		<>
			<PointIdentity point={hovered} />
			<dl className="mt-2 grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-1 tabular-nums">
				{figures(props).map((f) => (
					<div key={f.row.label} className="contents">
						<dt className="text-muted">{f.row.label}</dt>
						<dd className="text-right text-fg">{shown(f, f.b)}</dd>
						<dd className="text-right">
							<span
								className={`rounded px-1.5 py-px text-[11px] font-medium whitespace-nowrap ${TONE_CLASS[f.change.tone]} ${chipBg(f.change.tone)}`}
							>
								{f.change.text}
							</span>
						</dd>
					</div>
				))}
			</dl>
			<p className="mt-2 flex items-center gap-1.5 border-t border-line pt-1.5 text-[11px] text-subtle">
				Compared with
				<Who point={selected} />
			</p>
		</>
	);
}

function chipBg(tone: Change["tone"]) {
	if (tone === "better") return "bg-better/12";
	if (tone === "worse") return "bg-worse/12";
	return "";
}
