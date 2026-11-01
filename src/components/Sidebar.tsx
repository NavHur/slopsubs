import { type ReactNode, useEffect, useRef, useState } from "react";
import { samples } from "#/data";
import type { FamilyId, Plan, PlanId } from "#/domain/model";
import {
	type PlanCapacity,
	planCapacity,
	valueMultiple,
	weeklyAllowance,
} from "#/domain/value";
import {
	familyColor,
	familyLab,
	familyLabId,
	familyMatches,
	familyName,
} from "#/lib/families";
import { formatMultiple } from "#/lib/format";
import { isTextEntryTarget } from "#/lib/textEntry";
import {
	allSelected,
	COVERED_FAMILIES,
	FRONTIER_FAMILIES,
	FRONTIER_TIERS,
	frontierTier,
	NOTABLE_FAMILIES,
	toggled,
	toggledGroup,
} from "#/lib/view";
import { PricingSwatch, SwatchSpace } from "./chart/PricingKey";
import type { PricingId, PricingStyle } from "./chart/series";
import { ProviderLogo } from "./ProviderLogo";
import { Chip } from "./Segmented";

type KnownCapacity = Exclude<PlanCapacity, { kind: "unmeasured" }>;
type ValuedPlan = { plan: Plan; capacity: KnownCapacity };

/** Splits plans by whether their weekly cap is known, working each out once. */
function byCapacity(plans: readonly Plan[]): {
	valued: ValuedPlan[];
	unmeasured: Plan[];
} {
	const valued: ValuedPlan[] = [];
	const unmeasured: Plan[] = [];
	for (const plan of plans) {
		const capacity = planCapacity(plan, samples);
		if (capacity.kind === "unmeasured") unmeasured.push(plan);
		else valued.push({ plan, capacity });
	}
	return { valued, unmeasured };
}

/** Shown when the cap covers none of the plan's models, as a published
 * allowance may: there is no multiple to give. */
const NO_MULTIPLE = "—";

/** "12×", or "1.5–6×" when the multiple differs by model. */
function multipleText(plan: Plan, capacity: PlanCapacity): string {
	const multiples = plan.families
		.map((family) => weeklyAllowance(plan, capacity, family))
		.filter((allowance) => allowance !== null)
		.map((allowance) => valueMultiple({ plan, allowance }));
	if (multiples.length === 0) return NO_MULTIPLE;
	const low = Math.min(...multiples);
	const high = Math.max(...multiples);
	if (formatMultiple(low) === formatMultiple(high)) return formatMultiple(low);
	return `${formatMultiple(low).replace("×", "")}–${formatMultiple(high)}`;
}

function PlanValue({ plan, capacity }: ValuedPlan) {
	const text = multipleText(plan, capacity);
	if (capacity.kind === "measured") {
		return (
			<span
				className="whitespace-nowrap tabular-nums text-[12px] text-fg"
				title={`${capacity.sampleCount} samples, ${capacity.gaugePercentObserved.toFixed(0)}% of the weekly gauge observed`}
			>
				{text}
			</span>
		);
	}
	const source =
		capacity.kind === "published" ? capacity.allowance : capacity.report;
	return (
		<a
			href={source.url}
			target="_blank"
			rel="noreferrer"
			onClick={(event) => event.stopPropagation()}
			className="whitespace-nowrap tabular-nums text-[12px] text-muted underline decoration-dotted underline-offset-2 hover:text-fg"
			title={`${source.basis}. Not measured yet.`}
		>
			{text}
		</a>
	);
}

function PlanPrice({ plan }: { plan: Plan }) {
	const estimate = plan.confidence === "primary" ? "" : "*";
	return (
		<span
			className="text-[11px] text-subtle"
			title={estimate && `Price from ${plan.confidence} sources`}
		>
			${plan.monthlyPriceUsd}
			{estimate}
		</span>
	);
}

/**
 * A checkbox that puts a pricing on the chart, beside the line style the
 * chart draws it with while it has lines there.
 */
function PricingRow({
	label,
	checked,
	onChange,
	lineStyle,
	detail,
	value,
}: {
	label: string;
	checked: boolean;
	onChange: () => void;
	lineStyle: PricingStyle | undefined;
	detail: ReactNode;
	value: ReactNode;
}) {
	return (
		<label className="flex cursor-pointer items-center gap-1.5 py-1 text-[13px] hover:text-fg max-lg:min-h-11 max-lg:gap-2 max-lg:text-[15px]">
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				className="size-3.5 accent-accent"
			/>
			<span className="flex text-muted">
				{lineStyle ? <PricingSwatch pricing={lineStyle} /> : <SwatchSpace />}
			</span>
			<span className={checked ? "text-fg" : "text-muted"}>{label}</span>
			{detail}
			<span className="ml-auto">{value}</span>
		</label>
	);
}

/** API prices: the baseline every value multiple is measured against. */
function ApiRow({
	shown,
	lineStyle,
	onToggle,
}: {
	shown: boolean;
	lineStyle: PricingStyle | undefined;
	onToggle: () => void;
}) {
	return (
		<div className="mb-3">
			<h3 className="mb-1 text-[12px] font-medium text-subtle">
				Pay per token
			</h3>
			<PricingRow
				label="API"
				checked={shown}
				onChange={onToggle}
				lineStyle={lineStyle}
				detail={<span className="text-[11px] text-subtle">list price</span>}
				value={
					<span className="whitespace-nowrap tabular-nums text-[12px] text-fg">
						1×
					</span>
				}
			/>
		</div>
	);
}

export function PlanList({
	plans,
	selected,
	styles,
	showApi,
	onToggle,
	onToggleApi,
}: {
	plans: readonly Plan[];
	selected: readonly PlanId[];
	/** How the chart draws each pricing it has lines for. */
	styles: ReadonlyMap<PricingId, PricingStyle>;
	showApi: boolean;
	onToggle: (plan: PlanId) => void;
	onToggleApi: () => void;
}) {
	const { valued, unmeasured } = byCapacity(plans);
	return (
		<section aria-labelledby="plans-heading">
			<div className="flex items-baseline justify-between">
				<h2 id="plans-heading" className="text-[15px] font-semibold">
					Plans
				</h2>
				<span className="text-[11px] text-subtle">value at full cap</span>
			</div>
			<p className="mb-3 text-[11px] text-subtle">
				Effective cost = API cost ÷ value multiple
			</p>
			<ApiRow
				shown={showApi}
				lineStyle={styles.get("api")}
				onToggle={onToggleApi}
			/>
			{valued.length === 0 && (
				<p className="mb-3 text-[12px] leading-5 text-muted">
					No plan measured yet. Record <code>/usage</code> marks with{" "}
					<code>bun run measure</code> to plot one.
				</p>
			)}
			{[...Map.groupBy(valued, (v) => v.plan.vendor)].map(([vendor, group]) => (
				<div key={vendor} className="mb-3">
					<h3 className="mb-1 text-[12px] font-medium text-subtle">{vendor}</h3>
					<ul>
						{group.map(({ plan, capacity }) => (
							<li key={plan.id}>
								<PricingRow
									label={plan.label}
									checked={selected.includes(plan.id)}
									onChange={() => onToggle(plan.id)}
									lineStyle={styles.get(plan.id)}
									detail={<PlanPrice plan={plan} />}
									value={<PlanValue plan={plan} capacity={capacity} />}
								/>
							</li>
						))}
					</ul>
				</div>
			))}
			{unmeasured.length > 0 && <UnmeasuredPlans plans={unmeasured} />}
		</section>
	);
}

function UnmeasuredPlans({ plans }: { plans: readonly Plan[] }) {
	return (
		<details className="group text-[13px] max-lg:text-[15px]">
			<summary className="cursor-pointer py-1 text-muted hover:text-fg max-lg:py-3">
				Not yet measured ({plans.length})
			</summary>
			<ul className="mt-1">
				{plans.map((plan) => (
					<li
						key={plan.id}
						className="flex items-center gap-2 py-0.5 max-lg:min-h-11"
					>
						<a
							href={plan.sourceUrl}
							target="_blank"
							rel="noreferrer"
							title={plan.limits}
							className="truncate text-muted hover:text-fg"
						>
							{plan.label}
						</a>
						<span className="ml-auto">
							<PlanPrice plan={plan} />
						</span>
					</li>
				))}
			</ul>
		</details>
	);
}

/** Whether a "/" keydown should focus `input`, rather than being typed. */
function isSlashShortcut(
	event: KeyboardEvent,
	input: HTMLInputElement | null,
): boolean {
	if (event.key !== "/" || event.metaKey || event.ctrlKey) return false;
	if (isTextEntryTarget(event.target)) return false;
	// The sidebar is hidden on phones until the sheet opens.
	return input?.checkVisibility() === true;
}

/** Focuses `input` on "/" unless the user is already typing somewhere. */
function useSlashToFocus(input: React.RefObject<HTMLInputElement | null>) {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!isSlashShortcut(event, input.current)) return;
			event.preventDefault();
			input.current?.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [input]);
}

function ModelSearch({
	query,
	onChange,
}: {
	query: string;
	onChange: (query: string) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	useSlashToFocus(inputRef);
	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key !== "Escape" || query === "") return;
		// Clear the query first; a second Escape closes the phone sheet.
		event.nativeEvent.stopPropagation();
		onChange("");
	};
	return (
		<div className="mb-4 flex items-center gap-2 border-b border-line text-[13px] focus-within:border-muted max-lg:text-[15px]">
			<SearchIcon />
			<input
				ref={inputRef}
				type="search"
				value={query}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder="Find models"
				aria-label="Find a model"
				className="min-w-0 flex-1 bg-transparent py-1.5 text-fg placeholder:text-subtle focus:outline-none max-lg:min-h-11 [&::-webkit-search-cancel-button]:hidden"
			/>
			{query === "" ? (
				<kbd className="font-sans text-[11px] text-subtle max-lg:hidden">/</kbd>
			) : (
				<button
					type="button"
					aria-label="Clear search"
					onClick={() => onChange("")}
					className="px-1 text-subtle hover:text-fg max-lg:min-h-11 max-lg:px-2"
				>
					×
				</button>
			)}
		</div>
	);
}

function SearchIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 16 16"
			className="size-3.5 shrink-0 text-subtle"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<circle cx="7" cy="7" r="4.5" />
			<path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
		</svg>
	);
}

function ResetButton({
	disabled,
	onReset,
}: {
	disabled: boolean;
	onReset: () => void;
}) {
	return (
		<button
			type="button"
			aria-label="Reset models"
			title="Reset to the default models"
			disabled={disabled}
			onClick={onReset}
			className="-mr-1 p-1 text-subtle hover:text-fg disabled:opacity-40 disabled:hover:text-subtle max-lg:-mr-2 max-lg:p-3"
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				className="size-3.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
				<path d="M2.5 2.5v2.5H5" />
			</svg>
		</button>
	);
}

/** The benchmark on the chart, and the families it has a score for. */
export type Coverage = {
	benchmarkName: string;
	scored: ReadonlySet<FamilyId>;
};

function FamilyRow({
	family,
	on,
	unscoredNote,
	onToggle,
}: {
	family: FamilyId;
	on: boolean;
	/** Why the family plots nothing on this benchmark, when it doesn't. */
	unscoredNote: string | undefined;
	onToggle: (family: FamilyId) => void;
}) {
	const title = `${familyName(family)} · ${familyLab(family)}`;
	return (
		<li>
			<button
				type="button"
				aria-pressed={on}
				title={unscoredNote ? `${title} · ${unscoredNote}` : title}
				onClick={() => onToggle(family)}
				className={`flex w-full items-center gap-2 py-1 text-left text-[13px] hover:text-fg aria-pressed:text-fg max-lg:min-h-11 max-lg:text-[15px] ${unscoredNote ? "text-subtle" : "text-muted"}`}
			>
				<ProviderLogo lab={familyLabId(family)} />
				<span className="mr-auto">
					{familyName(family)}
					{unscoredNote && (
						<span className="ml-2 text-[11px] italic">{unscoredNote}</span>
					)}
				</span>
				<span
					className="size-2 rounded-full border"
					style={{
						borderColor: familyColor(family),
						background: on ? familyColor(family) : "transparent",
					}}
				/>
			</button>
		</li>
	);
}

type Selection = {
	selected: readonly FamilyId[];
	onSelect: (families: FamilyId[]) => void;
};

function unscoredNote(
	coverage: Coverage,
	family: FamilyId,
): string | undefined {
	if (coverage.scored.has(family)) return undefined;
	return `No ${coverage.benchmarkName} score`;
}

function FamilyGroup({
	title,
	families,
	selection,
	coverage,
	actions,
}: {
	title: string;
	families: readonly FamilyId[];
	selection: Selection;
	coverage: Coverage;
	actions?: React.ReactNode;
}) {
	const { selected, onSelect } = selection;
	return (
		<section aria-label={title} className="mb-3">
			<div className="mb-1 flex items-baseline justify-between gap-2">
				<h3 className="text-[12px] font-medium text-subtle">{title}</h3>
				{actions && <div className="flex gap-x-2.5">{actions}</div>}
			</div>
			{families.length === 0 && (
				<p className="py-1 text-[13px] text-muted">No model matches.</p>
			)}
			<ul>
				{families.map((family) => (
					<FamilyRow
						key={family}
						family={family}
						on={selected.includes(family)}
						unscoredNote={unscoredNote(coverage, family)}
						onToggle={(f) => onSelect(toggled(selected, f))}
					/>
				))}
			</ul>
		</section>
	);
}

/** Selects or clears a whole set of families at once. */
function GroupChip({
	label,
	group,
	selection,
}: {
	label: string;
	group: readonly FamilyId[];
	selection: Selection;
}) {
	const { selected, onSelect } = selection;
	return (
		<Chip
			label={label}
			on={allSelected(selected, group)}
			onClick={() => onSelect(toggledGroup(selected, group))}
		/>
	);
}

function FrontierTierChips({ selection }: { selection: Selection }) {
	return FRONTIER_TIERS.map((tier) => {
		const group = FRONTIER_FAMILIES.filter((f) => frontierTier(f) === tier);
		if (group.length === 0) return null;
		return (
			<GroupChip key={tier} label={tier} group={group} selection={selection} />
		);
	});
}

export function FamilyList({
	selected,
	filters,
	isDefault,
	coverage,
	onSelect,
	onReset,
}: {
	selected: readonly FamilyId[];
	/** Controls that narrow what the chart plots, above the model list. */
	filters: ReactNode;
	isDefault: boolean;
	coverage: Coverage;
	onSelect: (families: FamilyId[]) => void;
	onReset: () => void;
}) {
	const [query, setQuery] = useState("");
	const selection = { selected, onSelect };
	return (
		<section aria-labelledby="models-heading">
			<div className="mb-2 flex items-center justify-between">
				<h2 id="models-heading" className="text-[15px] font-semibold">
					Models{" "}
					<span className="ml-1 text-[12px] font-normal text-subtle tabular-nums">
						{selected.length}
					</span>
				</h2>
				<ResetButton disabled={isDefault} onReset={onReset} />
			</div>
			<ModelSearch query={query} onChange={setQuery} />
			{filters}
			{query.trim() === "" ? (
				<>
					<FamilyGroup
						title="Frontier"
						families={FRONTIER_FAMILIES}
						selection={selection}
						coverage={coverage}
						actions={<FrontierTierChips selection={selection} />}
					/>
					<FamilyGroup
						title="Notable"
						families={NOTABLE_FAMILIES}
						selection={selection}
						coverage={coverage}
						actions={
							<GroupChip
								label="All"
								group={NOTABLE_FAMILIES}
								selection={selection}
							/>
						}
					/>
				</>
			) : (
				<FamilyGroup
					title="Results"
					families={COVERED_FAMILIES.filter((f) => familyMatches(f, query))}
					selection={selection}
					coverage={coverage}
				/>
			)}
		</section>
	);
}
