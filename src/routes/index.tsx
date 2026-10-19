import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { AxisScale } from "#/components/chart/geometry";
import { PricingKey } from "#/components/chart/PricingKey";
import { buildSeries, pricingStyles } from "#/components/chart/series";
import { ValueChart } from "#/components/chart/ValueChart";
import {
	ChartSettingsMenu,
	DownloadPngButton,
	ThemeToggle,
} from "#/components/HeaderActions";
import { Segmented, Toggle } from "#/components/Segmented";
import { FamilyList, PlanList } from "#/components/Sidebar";
import { SidePanel } from "#/components/SidePanel";
import { benchmarks, plans, samples } from "#/data";
import { valuePoints } from "#/domain/value";
import { formatDay } from "#/lib/format";
import {
	DEFAULT_MODELS_VIEW,
	hiddenReasoning,
	isDefaultModelsView,
	selectedFamilies,
	selectedPlans,
	toggled,
	ViewSearch,
} from "#/lib/view";

export const Route = createFileRoute("/")({
	validateSearch: ViewSearch,
	component: ValueView,
});

const CHART_TITLE = "Effective cost vs intelligence";

const SCALE_OPTIONS = [
	{ value: "linear", label: "Linear" },
	{ value: "log", label: "Log" },
] as const satisfies readonly { value: AxisScale; label: string }[];

function FooterLink({
	href,
	title,
	children,
}: {
	href: string;
	title?: string;
	children: string;
}) {
	return (
		<a
			href={href}
			title={title}
			target="_blank"
			rel="noreferrer"
			className="underline decoration-dotted underline-offset-2 hover:text-fg"
		>
			{children}
		</a>
	);
}

function ValueView() {
	const view = Route.useSearch();
	const navigate = Route.useNavigate();
	const [panelOpen, setPanelOpen] = useState(false);
	const closePanel = useCallback(() => setPanelOpen(false), []);
	const update = (patch: Partial<ViewSearch>) =>
		navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

	const planIds = selectedPlans(view);
	const families = selectedFamilies(view);
	const points = valuePoints({
		benchmarks: benchmarks.models,
		families,
		plans: plans.filter((p) => planIds.includes(p.id)),
		samples,
		showApi: view.api,
		hiddenEfforts: hiddenReasoning(view),
	});

	const styles = pricingStyles(buildSeries(points));

	const chart = (
		<ValueChart
			points={points}
			scale={view.scale}
			showPareto={view.pareto}
			showLabels={view.labels}
		/>
	);
	const downloadPng = async () => {
		// Loaded on demand so visitors who never export skip the code.
		const { downloadChartPng } = await import("#/lib/exportPng");
		await downloadChartPng({
			// Labelled whatever the Labels setting: the image leaves the page,
			// and colour alone cannot tell its models apart.
			chart: (
				<ValueChart
					points={points}
					scale={view.scale}
					showPareto={view.pareto}
					showLabels
				/>
			),
			legend: (
				<PricingKey pricings={[...styles.values()]} className="justify-end" />
			),
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
					<section
						aria-labelledby="chart-heading"
						className="flex flex-col px-4 pt-5 pb-6 sm:px-7 lg:min-h-0 lg:flex-1 lg:pb-3"
					>
						<div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
							<h1 id="chart-heading" className="text-[17px] font-semibold">
								{CHART_TITLE}
							</h1>
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
						{chart}
						{/* From lg the side panel shows each plan's line style; the PNG draws its own key. */}
						<PricingKey
							pricings={[...styles.values()]}
							className="mt-3 lg:hidden"
						/>
					</section>
					<footer className="mt-auto flex flex-wrap justify-between gap-x-6 border-t border-line px-4 py-3 text-[12px] leading-5 text-muted sm:px-7">
						<span>
							Data from{" "}
							<FooterLink href="https://artificialanalysis.ai">
								Artificial Analysis
							</FooterLink>{" "}
							· estimated caps from{" "}
							<FooterLink
								href="https://www.youtube.com/watch?v=nYA0yASgaZI"
								title="Weekly caps from Theo's numbers until we measure them"
							>
								Theo
							</FooterLink>
						</span>
						<time
							dateTime={benchmarks.fetchedAt}
							title="When the benchmarks were fetched"
							className="text-subtle"
						>
							Updated {formatDay(benchmarks.fetchedAt)}
						</time>
					</footer>
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
