import { samples } from "#/data";
import type { FamilyId, Plan, PlanId, UsageProfile } from "#/domain/model";
import {
	apiUsdPerMonth,
	type PlanCapacity,
	planCapacity,
	valueMultiple,
} from "#/domain/value";
import { familyColor, familyName } from "#/lib/families";
import { formatMultiple } from "#/lib/format";

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
								<label className="flex cursor-pointer items-center gap-2 py-1 text-[13px] hover:text-fg">
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
		<details className="group text-[13px]">
			<summary className="cursor-pointer py-1 text-muted hover:text-fg">
				Not yet measured ({plans.length})
			</summary>
			<ul className="mt-1">
				{plans.map((plan) => (
					<li key={plan.id} className="flex items-center gap-2 py-0.5">
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

export function FamilyList({
	families,
	selected,
	onToggle,
}: {
	families: readonly FamilyId[];
	selected: readonly FamilyId[];
	onToggle: (family: FamilyId) => void;
}) {
	return (
		<section aria-labelledby="models-heading">
			<h2 id="models-heading" className="mb-2 text-[15px] font-semibold">
				Models
			</h2>
			<ul>
				{families.map((family) => {
					const on = selected.includes(family);
					return (
						<li key={family}>
							<button
								type="button"
								aria-pressed={on}
								onClick={() => onToggle(family)}
								className="flex w-full items-center justify-between py-1 text-left text-[13px] text-muted hover:text-fg aria-pressed:text-fg"
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
				})}
			</ul>
		</section>
	);
}
