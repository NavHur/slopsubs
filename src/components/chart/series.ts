import type { FamilyId, PlanId } from "#/domain/model";
import type { Pricing, ValuePoint } from "#/domain/value";
import { familyColor, familyName } from "#/lib/families";

/**
 * Point shapes for subscription plans, handed out in the order plans first
 * appear. API points keep hollow circles on a dashed line.
 * ceiling: plans past the fifth reuse shapes; add more if people often
 * compare that many at once.
 */
const PLAN_MARKERS = [
	"circle",
	"square",
	"diamond",
	"triangle",
	"triangle-down",
] as const;
export type PointMarker = (typeof PLAN_MARKERS)[number];

/** A pricing's identity: "api", or the subscription plan's id. */
export type PricingId = PlanId | "api";

/** How a line is paid for, and how the chart draws that. */
export type PricingStyle = {
	id: PricingId;
	/** "API", or the subscription plan's label. */
	label: string;
	isApi: boolean;
	marker: PointMarker;
	/** Stroke width of the pricing's line, and of its key swatch. */
	lineWidth: number;
};

/** One line on the chart: a model under one pricing. */
export type Series = {
	id: string;
	points: ValuePoint[];
	/** "Haiku 5.5 · Claude Ultra" */
	label: string;
	modelId: FamilyId;
	color: string;
	pricing: PricingStyle;
};

/** Every line of one model; it gets one label and one legend entry. */
export type ModelGroup = {
	id: FamilyId;
	name: string;
	color: string;
	/** A model exists on the chart only through its lines, so never empty. */
	series: [Series, ...Series[]];
};

/** Dash pattern of API lines, which keep a hollow marker. */
export const API_DASH = "3 4";

const API_STYLE: PricingStyle = {
	id: "api",
	label: "API",
	isApi: true,
	marker: "circle",
	lineWidth: 1.25,
};

function pricingStyle(
	pricing: Pricing,
	planOrder: readonly string[],
): PricingStyle {
	if (pricing.kind === "api") return API_STYLE;
	const index = planOrder.indexOf(pricing.plan.id);
	return {
		id: pricing.plan.id,
		label: pricing.plan.label,
		isApi: false,
		marker: PLAN_MARKERS[index % PLAN_MARKERS.length],
		lineWidth: 2,
	};
}

export function buildSeries(points: readonly ValuePoint[]): Series[] {
	const planOrder = [
		...new Set(
			points.flatMap((p) =>
				p.pricing.kind === "plan" ? p.pricing.plan.id : [],
			),
		),
	];
	const groups = Map.groupBy(points, (p) => p.seriesId);
	return [...groups].map(([id, members]) => {
		const { benchmark, pricing } = members[0];
		const style = pricingStyle(pricing, planOrder);
		return {
			id,
			points: members,
			label: `${familyName(benchmark.family)} · ${style.label}`,
			modelId: benchmark.family,
			color: familyColor(benchmark.family),
			pricing: style,
		};
	});
}

export function groupByModel(series: readonly Series[]): ModelGroup[] {
	const groups = new Map<FamilyId, ModelGroup>();
	for (const s of series) {
		const group = groups.get(s.modelId);
		if (group) {
			group.series.push(s);
			continue;
		}
		groups.set(s.modelId, {
			id: s.modelId,
			name: familyName(s.modelId),
			color: s.color,
			series: [s],
		});
	}
	return [...groups.values()];
}

/** How each pricing on the chart is drawn, in the order its lines appear. */
export function pricingStyles(
	series: readonly Series[],
): Map<PricingId, PricingStyle> {
	return new Map(series.map((s) => [s.pricing.id, s.pricing]));
}

/** The model's line end furthest right, where its label's leader line starts. */
export function modelEnd(model: ModelGroup): ValuePoint {
	const lineEnd = (s: Series) => s.points[s.points.length - 1];
	return model.series
		.map(lineEnd)
		.reduce(
			(a, b) => (b.costPerTaskUsd > a.costPerTaskUsd ? b : a),
			lineEnd(model.series[0]),
		);
}
