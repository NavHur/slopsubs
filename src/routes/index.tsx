import { createFileRoute } from "@tanstack/react-router";
import type { AxisScale } from "#/components/chart/geometry";
import { ValueChart } from "#/components/chart/ValueChart";
import { Segmented, Toggle } from "#/components/Segmented";
import { FamilyList, PlanList } from "#/components/Sidebar";
import { benchmarks, plans, samples } from "#/data";
import { USAGE_PROFILES } from "#/domain/model";
import { valuePoints } from "#/domain/value";
import {
	COVERED_FAMILIES,
	profileOf,
	selectedFamilies,
	selectedPlans,
	toggled,
	ViewSearch,
} from "#/lib/view";

export const Route = createFileRoute("/")({
	validateSearch: ViewSearch,
	component: ValueView,
});

const PROFILE_OPTIONS = USAGE_PROFILES.map((p) => ({
	value: p.id,
	label: `${p.label} · ${Math.round(p.weeklyCapShare * 100)}%`,
	hint: `Uses ${Math.round(p.weeklyCapShare * 100)}% of the weekly cap every week`,
}));

const SCALE_OPTIONS = [
	{ value: "linear", label: "Linear" },
	{ value: "log", label: "Log" },
] as const satisfies readonly { value: AxisScale; label: string }[];

function ValueView() {
	const view = Route.useSearch();
	const navigate = Route.useNavigate();
	const update = (patch: Partial<ViewSearch>) =>
		navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

	const profile = profileOf(view);
	const planIds = selectedPlans(view);
	const families = selectedFamilies(view);
	const points = valuePoints({
		benchmarks: benchmarks.models,
		families,
		plans: plans.filter((p) => planIds.includes(p.id)),
		samples,
		profile,
		showApi: view.api,
	});

	return (
		<div className="grid min-h-screen grid-rows-[60px_1fr_auto] bg-bg text-fg">
			<header className="flex items-center gap-8 border-b border-line px-7">
				<a href="/" className="text-[22px] font-semibold tracking-tight">
					slop<span className="text-accent">subs</span>
				</a>
				<p className="text-[13px] text-muted">
					What a task really costs on a subscription
				</p>
			</header>
			<div className="grid grid-cols-[1fr_260px] max-lg:grid-cols-1">
				<main className="min-w-0 px-7 py-5">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-4">
						<h1 className="text-[17px] font-semibold">
							Effective cost vs intelligence
						</h1>
						<div className="flex flex-wrap items-center gap-6">
							<Segmented
								label="Usage profile"
								options={PROFILE_OPTIONS}
								value={view.profile}
								onChange={(value) => update({ profile: value })}
							/>
							<Toggle
								label="API prices"
								checked={view.api}
								onChange={(api) => update({ api })}
							/>
							<Toggle
								label="Pareto line"
								checked={view.pareto}
								onChange={(pareto) => update({ pareto })}
							/>
							<Segmented
								label="Cost axis scale"
								options={SCALE_OPTIONS}
								value={view.scale}
								onChange={(scale) => update({ scale })}
							/>
						</div>
					</div>
					<ValueChart
						points={points}
						scale={view.scale}
						showPareto={view.pareto}
					/>
				</main>
				<aside className="space-y-6 border-l border-line px-6 py-5 max-lg:border-t max-lg:border-l-0">
					<PlanList
						plans={plans}
						selected={planIds}
						profile={profile}
						onToggle={(id) => update({ plans: toggled(planIds, id) })}
					/>
					<FamilyList
						families={COVERED_FAMILIES}
						selected={families}
						onToggle={(family) =>
							update({ families: toggled(families, family) })
						}
					/>
				</aside>
			</div>
			<footer className="flex justify-between border-t border-line px-7 py-3 text-[12px] text-muted">
				<span>
					Benchmarks from Artificial Analysis (
					{benchmarks.fetchedAt.slice(0, 10)}) · weekly caps measured from real
					sessions
				</span>
				<span>Effective cost = API cost ÷ value multiple</span>
			</footer>
		</div>
	);
}
