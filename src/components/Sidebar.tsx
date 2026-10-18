import { useEffect, useRef, useState } from "react";
import { samples } from "#/data";
import type { FamilyId, Plan, PlanId, UsageProfile } from "#/domain/model";
import {
	apiUsdPerMonth,
	type PlanCapacity,
	planCapacity,
	valueMultiple,
} from "#/domain/value";
import {
	familyColor,
	familyLab,
	familyMatches,
	familyName,
} from "#/lib/families";
import { formatMultiple } from "#/lib/format";
import {
	allSelected,
	COVERED_FAMILIES,
	FRONTIER_FAMILIES,
	FRONTIER_TIERS,
	frontierTier,
	NOTABLE_FAMILIES,
	REASONING_LEVELS,
	type ReasoningLevel,
	toggled,
	toggledGroup,
} from "#/lib/view";

/** "12×", or "1.5–6×" when the multiple differs by model. */
function multipleText(
	plan: Plan,
	capacity: PlanCapacity,
	profile: UsageProfile,
): string {
	const multiples = plan.families
		.map((family) => apiUsdPerMonth(capacity, family))
		.filter((usd) => usd !== null)
		.map((usd) => valueMultiple({ plan, apiUsdPerMonth: usd, profile }));
	const low = Math.min(...multiples);
	const high = Math.max(...multiples);
	if (formatMultiple(low) === formatMultiple(high)) return formatMultiple(low);
	return `${formatMultiple(low).replace("×", "")}–${formatMultiple(high)}`;
}

function PlanValue({ plan, profile }: { plan: Plan; profile: UsageProfile }) {
	const capacity = planCapacity(plan, samples);
	if (capacity.kind === "unmeasured") {
		return <span className="text-[11px] text-subtle">unmeasured</span>;
	}
	const text = multipleText(plan, capacity, profile);
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

function hasCap(plan: Plan): boolean {
	return planCapacity(plan, samples).kind !== "unmeasured";
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

export function PlanList({
	plans,
	selected,
	profile,
	onToggle,
}: {
	plans: readonly Plan[];
	selected: readonly PlanId[];
	profile: UsageProfile;
	onToggle: (plan: PlanId) => void;
}) {
	const valued = plans.filter(hasCap);
	const unmeasured = plans.filter((p) => !hasCap(p));
	return (
		<section aria-labelledby="plans-heading">
			<div className="mb-2 flex items-baseline justify-between">
				<h2 id="plans-heading" className="text-[15px] font-semibold">
					Plans
				</h2>
				<span className="text-[11px] text-subtle">
					value at {Math.round(profile.weeklyCapShare * 100)}% of cap
				</span>
			</div>
			{valued.length === 0 && (
				<p className="mb-3 text-[12px] leading-5 text-muted">
					No plan measured yet. Record <code>/usage</code> marks with{" "}
					<code>pnpm measure</code> to plot one.
				</p>
			)}
			{[...Map.groupBy(valued, (p) => p.vendor)].map(([vendor, group]) => (
				<div key={vendor} className="mb-3">
					<h3 className="mb-1 text-[12px] font-medium text-subtle">{vendor}</h3>
					<ul>
						{group.map((plan) => (
							<li key={plan.id}>
								<label className="flex cursor-pointer items-center gap-2 py-1 text-[13px] hover:text-fg max-lg:min-h-11 max-lg:text-[15px]">
									<input
										type="checkbox"
										checked={selected.includes(plan.id)}
										onChange={() => onToggle(plan.id)}
										className="size-3.5 accent-accent"
									/>
									<span
										className={
											selected.includes(plan.id) ? "text-fg" : "text-muted"
										}
									>
										{plan.label}
									</span>
									<PlanPrice plan={plan} />
									<span className="ml-auto">
										<PlanValue plan={plan} profile={profile} />
									</span>
								</label>
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

/** Whether the keydown target is a field the user is typing into. */
function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || target.closest("input, textarea") !== null;
}

/** Whether a "/" keydown should focus `input`, rather than being typed. */
function isSlashShortcut(
	event: KeyboardEvent,
	input: HTMLInputElement | null,
): boolean {
	if (event.key !== "/" || event.metaKey || event.ctrlKey) return false;
	if (isTypingTarget(event.target)) return false;
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

/** A small text toggle, dimmed when off. */
function Chip({
	label,
	on,
	onClick,
	className = "",
}: {
	label: string;
	on: boolean;
	onClick: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={`text-[12px] text-subtle hover:text-fg aria-pressed:text-fg max-lg:min-h-11 max-lg:text-[14px] ${className}`}
		>
			{label}
		</button>
	);
}

function ReasoningFilter({
	hidden,
	onChange,
}: {
	hidden: readonly ReasoningLevel[];
	onChange: (hidden: ReasoningLevel[]) => void;
}) {
	const toggle = (level: ReasoningLevel) => {
		const next = toggled(hidden, level);
		onChange(REASONING_LEVELS.filter((l) => next.includes(l)));
	};
	return (
		<fieldset aria-label="Reasoning" className="mb-4">
			<h3 className="mb-1 text-[12px] font-medium text-subtle">Reasoning</h3>
			<div className="flex flex-wrap gap-x-2.5 max-lg:gap-x-4">
				{REASONING_LEVELS.map((level) => (
					<Chip
						key={level}
						label={level}
						on={!hidden.includes(level)}
						onClick={() => toggle(level)}
						className="line-through aria-pressed:no-underline"
					/>
				))}
			</div>
		</fieldset>
	);
}

function FamilyRow({
	family,
	on,
	onToggle,
}: {
	family: FamilyId;
	on: boolean;
	onToggle: (family: FamilyId) => void;
}) {
	return (
		<li>
			<button
				type="button"
				aria-pressed={on}
				title={`${familyName(family)} · ${familyLab(family)}`}
				onClick={() => onToggle(family)}
				className="flex w-full items-center justify-between py-1 text-left text-[13px] text-muted hover:text-fg aria-pressed:text-fg max-lg:min-h-11 max-lg:text-[15px]"
			>
				{familyName(family)}
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

function FamilyGroup({
	title,
	families,
	selection,
	actions,
}: {
	title: string;
	families: readonly FamilyId[];
	selection: Selection;
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
	hiddenReasoning,
	isDefault,
	onSelect,
	onHideReasoning,
	onReset,
}: {
	selected: readonly FamilyId[];
	hiddenReasoning: readonly ReasoningLevel[];
	isDefault: boolean;
	onSelect: (families: FamilyId[]) => void;
	onHideReasoning: (hidden: ReasoningLevel[]) => void;
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
			<ReasoningFilter hidden={hiddenReasoning} onChange={onHideReasoning} />
			{query.trim() === "" ? (
				<>
					<FamilyGroup
						title="Frontier"
						families={FRONTIER_FAMILIES}
						selection={selection}
						actions={<FrontierTierChips selection={selection} />}
					/>
					<FamilyGroup
						title="Notable"
						families={NOTABLE_FAMILIES}
						selection={selection}
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
				/>
			)}
		</section>
	);
}
