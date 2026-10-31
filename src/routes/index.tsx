import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { AxisScale } from "#/components/chart/geometry";
import { PricingKey } from "#/components/chart/PricingKey";
import { RankedChart } from "#/components/chart/RankedChart";
import { buildSeries, pricingStyles } from "#/components/chart/series";
import { CapBasisKey, TasksChart } from "#/components/chart/TasksChart";
import { ValueChart } from "#/components/chart/ValueChart";
import { ChartSection } from "#/components/ChartSection";
import { ChartSettingsMenu, ThemeToggle } from "#/components/HeaderActions";
import { CodeOnlyFilter, ReasoningFilter } from "#/components/ModelFilters";
import { PageFooter } from "#/components/PageFooter";
import { SectionNav } from "#/components/SectionNav";
import { Segmented, Toggle } from "#/components/Segmented";
import { type Coverage, FamilyList, PlanList } from "#/components/Sidebar";
import { SidePanel } from "#/components/SidePanel";
import { leaderboards, plans, samples } from "#/data";
import { BENCHMARK_IDS, type LeaderboardId } from "#/domain/model";
import { rankedCost, tasksPerWeek } from "#/domain/ranges";
import { valuePoints } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { useSectionNav } from "#/lib/useSectionNav";
import {
	CHART_SECTIONS,
	type ChartSectionId,
	codeOnlyApplies,
	DEFAULT_MODELS_VIEW,
	hiddenReasoning,
	isDefaultModelsView,
	plottedLeaderboard,
	selectedFamilies,
	selectedPlans,
	toggled,
	ViewSearch,
} from "#/lib/view";

export const Route = createFileRoute("/")({
	validateSearch: ViewSearch,
	component: ValueView,
});

const BENCHMARK_OPTIONS = BENCHMARK_IDS.map((id) => ({
	value: id,
	label: BENCHMARK_VIEWS[id].tabLabel,
}));

const SECTION_LABELS: Record<ChartSectionId, string> = {
	"cost-vs-score": "Cost vs score",
	"tasks-per-week": "Tasks per week",
	"ranked-cost": "Cost per task",
};
/** On the ranked chart, solid dots cover API prices too. */
const RANKED_KEY = "API price, or a published or measured cap";
const SECTION_LINKS = CHART_SECTIONS.map((id) => ({
	id,
	label: SECTION_LABELS[id],
}));

function coverageOf(id: LeaderboardId): Coverage {
	return {
		benchmarkName: BENCHMARK_VIEWS[id].tabLabel,
		scored: new Set(leaderboards[id].models.map((m) => m.family)),
	};
}

// Built once per leaderboard, not per render or row.
const COVERAGE: Record<LeaderboardId, Coverage> = {
	intelligence: coverageOf("intelligence"),
	frontiercode: coverageOf("frontiercode"),
	coding: coverageOf("coding"),
};

const SCALE_OPTIONS = [
	{ value: "linear", label: "Linear" },
	{ value: "log", label: "Log" },
] as const satisfies readonly { value: AxisScale; label: string }[];

/** Loaded on demand so visitors who never export skip the code. */
async function exporter() {
	return (await import("#/lib/exportPng")).downloadChartPng;
}

function ValueView() {
	const view = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const [panelOpen, setPanelOpen] = useState(false);
	const closePanel = useCallback(() => setPanelOpen(false), []);
	const update = (patch: Partial<ViewSearch>) =>
		navigate({
			search: (prev) => ({ ...prev, ...patch }),
			replace: true,
			resetScroll: false,
		});
	const nav = useSectionNav(CHART_SECTIONS, view.chart, (chart) =>
		update({ chart }),
	);

	const sectionHref = (id: ChartSectionId) =>
		router.buildLocation({
			to: "/",
			search: { ...view, chart: id === CHART_SECTIONS[0] ? undefined : id },
		}).href;

	const plotted = plottedLeaderboard(view);
	const benchmark = BENCHMARK_VIEWS[plotted];
	const leaderboard = leaderboards[plotted];
	const planIds = selectedPlans(view);
	const families = selectedFamilies(view);
	const points = valuePoints({
		benchmarks: leaderboard.models,
		families,
		plans: plans.filter((p) => planIds.includes(p.id)),
		samples,
		showApi: view.api,
		hiddenEfforts: hiddenReasoning(view),
	});

	const styles = pricingStyles(buildSeries(points));
	const planTasks = tasksPerWeek(points);
	const costRows = rankedCost(points);

	const exportValueChart = async () => {
		const downloadChartPng = await exporter();
		await downloadChartPng({
			// Labelled whatever the Labels setting: the image leaves the page,
			// and colour alone cannot tell its models apart.
			chart: (
				<ValueChart
					points={points}
					scale={view.scale}
					showPareto={view.pareto}
					showLabels
					benchmark={benchmark}
				/>
			),
			legend: (
				<PricingKey pricings={[...styles.values()]} className="justify-end" />
			),
			title: benchmark.chartTitle,
			fileName: `slopsubs-effective-cost-${benchmark.id}.png`,
		});
	};

	const exportTasksChart = async () => {
		const downloadChartPng = await exporter();
		await downloadChartPng({
			chart: <TasksChart plans={planTasks} />,
			legend: <CapBasisKey className="justify-end" />,
			title: `${benchmark.tabLabel} tasks per week on each plan`,
			fileName: `slopsubs-tasks-per-week-${benchmark.id}.png`,
			height: "content",
		});
	};

	const exportRankedChart = async () => {
		const downloadChartPng = await exporter();
		await downloadChartPng({
			chart: <RankedChart rows={costRows} />,
			legend: <CapBasisKey solidLabel={RANKED_KEY} className="justify-end" />,
			title: `Effective cost per ${benchmark.tabLabel} task, cheapest first`,
			fileName: `slopsubs-ranked-cost-${benchmark.id}.png`,
			height: "content",
		});
	};

	return (
		<div className="flex min-h-dvh flex-col bg-bg text-fg lg:h-dvh">
			<header
				inert={panelOpen}
				className="flex h-(--header-h) shrink-0 items-center gap-8 border-b border-line px-4 sm:px-7"
			>
				<a href="/" className="text-[22px] font-semibold tracking-tight">
					slop<span className="text-accent">subs</span>
				</a>
				<p className="text-[13px] text-muted max-sm:hidden">
					What a task really costs on a subscription
				</p>
				<div className="-mr-2 ml-auto flex items-center gap-1">
					<ThemeToggle />
					<div className="max-sm:hidden">
						<ChartSettingsMenu
							labels={view.labels}
							onLabelsChange={(labels) => update({ labels })}
						/>
					</div>
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
			<div className="flex-1 lg:grid lg:min-h-0 lg:grid-cols-[1fr_288px]">
				<main
					inert={panelOpen}
					className="flex min-w-0 flex-col lg:overflow-y-auto"
				>
					<h1 className="sr-only">
						slopsubs: what a task really costs on a subscription
					</h1>
					<div className="sticky top-0 z-10 flex min-h-(--section-nav-h) flex-wrap items-center justify-between gap-x-6 border-b border-line bg-bg px-4 sm:px-7">
						<SectionNav
							sections={SECTION_LINKS}
							active={nav.active}
							hrefFor={sectionHref}
							onSelect={nav.scrollTo}
						/>
						<Segmented
							label="Benchmark that defines a task"
							options={BENCHMARK_OPTIONS}
							value={view.benchmark}
							onChange={(id) => update({ benchmark: id })}
						/>
					</div>
					<ChartSection
						id="cost-vs-score"
						title={benchmark.chartTitle}
						canExport={points.length > 0}
						onExport={exportValueChart}
						className="lg:h-[calc(100dvh-var(--header-h)-var(--section-nav-h))] lg:min-h-[540px]"
						controls={
							<>
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
							</>
						}
					>
						<ValueChart
							points={points}
							scale={view.scale}
							showPareto={view.pareto}
							showLabels={view.labels}
							benchmark={benchmark}
						/>
						{/* From lg the side panel shows each plan's line style; the PNG draws its own key. */}
						<PricingKey
							pricings={[...styles.values()]}
							className="mt-3 lg:hidden"
						/>
					</ChartSection>
					<ChartSection
						id="tasks-per-week"
						title="Tasks per week on each plan"
						canExport={planTasks.length > 0}
						onExport={exportTasksChart}
					>
						<p className="mb-3 max-w-[72ch] text-[13px] leading-5 text-muted">
							How many {benchmark.tabLabel} tasks a plan's weekly cap pays for
							when spent on one model at one effort: the cap in API-priced
							dollars over the task's API price. A plan's rows are alternatives,
							not a sum, and bundled API credit is left out.
						</p>
						<CapBasisKey className="mb-3" />
						{planTasks.length > 0 ? (
							<TasksChart plans={planTasks} />
						) : (
							<p className="py-10 text-center text-sm text-muted">
								No selected plan has a known cap for these models.
							</p>
						)}
					</ChartSection>
					<ChartSection
						id="ranked-cost"
						title="Effective cost per task, cheapest first"
						canExport={costRows.length > 0}
						onExport={exportRankedChart}
						controls={
							<Toggle
								label="API prices"
								checked={view.api}
								onChange={(api) => update({ api })}
							/>
						}
					>
						<p className="mb-3 max-w-[72ch] text-[13px] leading-5 text-muted">
							Each model on each selected plan, and at API prices when they are
							on, from low to max effort. Rows rank by their cheapest effort, so
							the top rows are the cheapest way to run a task at all.
						</p>
						<CapBasisKey solidLabel={RANKED_KEY} className="mb-3" />
						{costRows.length > 0 ? (
							<RankedChart rows={costRows} />
						) : (
							<p className="py-10 text-center text-sm text-muted">
								Select a plan, or turn on API prices above, to rank their costs.
							</p>
						)}
					</ChartSection>
					<PageFooter benchmark={benchmark} fetchedAt={leaderboard.fetchedAt} />
				</main>
				<SidePanel title="Plans & models" open={panelOpen} onClose={closePanel}>
					<PlanList
						plans={plans}
						selected={planIds}
						styles={styles}
						showApi={view.api}
						onToggle={(id) => update({ plans: toggled(planIds, id) })}
						onToggleApi={() => update({ api: !view.api })}
					/>
					<FamilyList
						selected={families}
						filters={
							<>
								<CodeOnlyFilter
									checked={view.code}
									applies={codeOnlyApplies(view.benchmark)}
									onChange={(code) => update({ code })}
								/>
								<ReasoningFilter
									hidden={hiddenReasoning(view)}
									onChange={(hideReasoning) => update({ hideReasoning })}
								/>
							</>
						}
						isDefault={isDefaultModelsView(view)}
						coverage={COVERAGE[plotted]}
						onSelect={(next) => update({ families: next })}
						onReset={() => update(DEFAULT_MODELS_VIEW)}
					/>
				</SidePanel>
			</div>
		</div>
	);
}
