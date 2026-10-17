import { samples } from "#/data";
import type { FamilyId, Plan, PlanId, UsageProfile } from "#/domain/model";
import { planCapacity, valueMultiple } from "#/domain/value";
import { familyColor, familyName } from "#/lib/families";
import { formatMultiple } from "#/lib/format";

function PlanValue({ plan, profile }: { plan: Plan; profile: UsageProfile }) {
	const capacity = planCapacity(plan.id, samples);
	if (capacity.kind === "unmeasured") {
		return <span className="text-[11px] text-subtle">unmeasured</span>;
	}
	const multiple = valueMultiple({
		plan,
		weeklyCapApiUsd: capacity.weeklyCapApiUsd,
		profile,
	});
	return (
		<span
			className="tabular-nums text-[12px] text-fg"
			title={`${capacity.sampleCount} samples, ${capacity.gaugePercentObserved.toFixed(0)}% of the weekly gauge observed`}
		>
			{formatMultiple(multiple)}
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
	const byVendor = Map.groupBy(plans, (p) => p.vendor);
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
			{[...byVendor].map(([vendor, vendorPlans]) => (
				<div key={vendor} className="mb-3">
					<h3 className="mb-1 text-[12px] font-medium text-subtle">{vendor}</h3>
					<ul>
						{vendorPlans.map((plan) => (
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
									<span className="text-[11px] text-subtle">
										${plan.monthlyPriceUsd}
									</span>
									<span className="ml-auto">
										<PlanValue plan={plan} profile={profile} />
									</span>
								</label>
							</li>
						))}
					</ul>
				</div>
			))}
		</section>
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
