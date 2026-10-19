import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { AxisScale } from "#/components/chart/geometry";
import { ValueChart } from "#/components/chart/ValueChart";
import { DownloadPngButton, ThemeToggle } from "#/components/HeaderActions";
import { Segmented, Toggle } from "#/components/Segmented";
import { FamilyList, PlanList } from "#/components/Sidebar";
import { SidePanel } from "#/components/SidePanel";
import { benchmarks, plans, samples } from "#/data";
import { USAGE_PROFILES } from "#/domain/model";
import { valuePoints } from "#/domain/value";
import {
	DEFAULT_MODELS_VIEW,
	hiddenReasoning,
	isDefaultModelsView,
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

const CHART_TITLE = "Effective cost vs intelligence";

const SCALE_OPTIONS = [
	{ value: "linear", label: "Linear" },
	{ value: "log", label: "Log" },
] as const satisfies readonly { value: AxisScale; label: string }[];

function ValueView() {
	const view = Route.useSearch();
	const navigate = Route.useNavigate();
	const [panelOpen, setPanelOpen] = useState(false);
	const closePanel = useCallback(() => setPanelOpen(false), []);
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
		hiddenEfforts: hiddenReasoning(view),
	});

	const chart = (
		<ValueChart points={points} scale={view.scale} showPareto={view.pareto} />
	);
	const downloadPng = async () => {
		// Loaded on demand so visitors who never export skip the code.
		const { downloadChartPng } = await import("#/lib/exportPng");
		await downloadChartPng({
			chart,
			title: CHART_TITLE,
			fileName: "slopsubs-effective-cost.png",
		});
	};

	return (
		<div className="flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh">
			<header
				inert={panelOpen}
				className="flex h-[60px] shrink-0 items-center gap-8 border-b border-line px-4 sm:px-7"
			>
				<a href="/" className="text-[22px] font-semibold tracking-tight">
					slop<span className="text-accent">subs</span>
				</a>
				<p className="text-[13px] text-muted max-sm:hidden">
					What a task really costs on a subscription
				</p>
				<div className="-mr-2 ml-auto flex items-center gap-1">
					<div className="max-sm:hidden">
						<DownloadPngButton
							disabled={points.length === 0}
							onDownload={downloadPng}
						/>
					</div>
					<ThemeToggle />
					<button
						type="button"
						onClick={() => setPanelOpen(true)}
						className="flex min-h-11 items-center gap-2 px-2 text-[15px] font-medium lg:hidden"
					>
						Plans &amp; models
						<span className="text-[13px] font-normal text-subtle tabular-nums">
							{planIds.length + families.length}
						</span>
					</button>
				</div>
			</header>
			<div className="flex-1 lg:grid lg:min-h-0 lg:grid-cols-[1fr_272px]">
				<main
					inert={panelOpen}
					className="flex min-w-0 flex-col lg:overflow-y-auto"
				>
					<section
						aria-labelledby="chart-heading"
						className="flex flex-col px-4 pt-5 pb-6 sm:px-7 lg:min-h-0 lg:flex-1 lg:pb-3"
					>
						<div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
							<h1 id="chart-heading" className="text-[17px] font-semibold">
								{CHART_TITLE}
							</h1>
							<div className="flex flex-wrap items-center gap-x-6 max-sm:w-full max-sm:justify-between">
								<Segmented
									label="Usage profile"
									options={PROFILE_OPTIONS}
									value={view.profile}
									onChange={(value) => update({ profile: value })}
								/>
								<div className="flex items-center gap-x-6 max-sm:w-full max-sm:justify-between">
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
						</div>
						{chart}
					</section>
					<footer className="mt-auto flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-line px-4 py-3 text-[12px] leading-5 text-muted sm:px-7">
						<span>
							Benchmarks from Artificial Analysis (
							{benchmarks.fetchedAt.slice(0, 10)}) · weekly caps from{" "}
							<a
								href="https://www.youtube.com/watch?v=nYA0yASgaZI"
								target="_blank"
								rel="noreferrer"
								className="underline decoration-dotted underline-offset-2 hover:text-fg"
							>
								Theo's numbers
							</a>{" "}
							until measured
						</span>
						<span>Effective cost = API cost ÷ value multiple</span>
					</footer>
				</main>
				<SidePanel title="Plans & models" open={panelOpen} onClose={closePanel}>
					<PlanList
						plans={plans}
						selected={planIds}
						profile={profile}
						onToggle={(id) => update({ plans: toggled(planIds, id) })}
					/>
					<FamilyList
						selected={families}
						hiddenReasoning={hiddenReasoning(view)}
						isDefault={isDefaultModelsView(view)}
						onSelect={(next) => update({ families: next })}
						onHideReasoning={(hideReasoning) => update({ hideReasoning })}
						onReset={() => update(DEFAULT_MODELS_VIEW)}
					/>
				</SidePanel>
			</div>
		</div>
	);
}
