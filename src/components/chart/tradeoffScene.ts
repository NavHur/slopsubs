import type { FamilyId } from "#/domain/model";
import { type TimedPoint, tradeoffFrontier } from "#/domain/tradeoffs";
import { formatUsd } from "#/lib/format";
import { COMPACT_WIDTH, LABEL_COLUMN_PX } from "./geometry";
import { AXES, type AxisId, FRAME_ANCHORS, plotSpace } from "./plotSpace";
import {
	type Angles,
	type Camera,
	fitCamera,
	type Projected,
	project,
	projectedLength,
	type Vec3,
	type Viewport,
} from "./projection";

/** Room around the cube for tick labels and the axis titles (px). */
const PADDING = { top: 36, right: 48, bottom: 46, left: 56 };

/** Heights of the plot at narrow and wide widths; between them it keeps
 * this shape, a little wider than tall. */
const MIN_HEIGHT_PX = 300;
const MAX_HEIGHT_PX = 620;
const HEIGHT_PER_WIDTH = 0.62;

export function tradeoffViewport(width: number): Viewport {
	const height = Math.round(
		Math.min(MAX_HEIGHT_PX, Math.max(MIN_HEIGHT_PX, width * HEIGHT_PER_WIDTH)),
	);
	const right = hasModelColumn(width) ? LABEL_COLUMN_PX : PADDING.right;
	return { width, height, padding: { ...PADDING, right } };
}

/** Wide plots name each model in a column on their right, as the cost and
 * score chart does; narrow ones leave that to a legend below. */
export function hasModelColumn(width: number): boolean {
	return width >= COMPACT_WIDTH;
}

/** An axis drawn shorter than this is seen nearly end-on, where its labels
 * would pile onto each other, so they hide. */
export const MIN_LABELLED_AXIS_PX = 60;

export type Segment = { x1: number; y1: number; x2: number; y2: number };
export type Anchor = { x: number; y: number };

export type TickLabel = Anchor & {
	key: string;
	text: string;
	anchor: "middle" | "end";
};

export type ScenePoint = {
	point: TimedPoint;
	at: Projected;
	/** Where the point's drop line meets the floor. */
	floor: Anchor;
	/** No other option is as cheap, as fast and as smart, and better on one. */
	worthWeighing: boolean;
};

/** A model's rightmost point, where its label's leader line starts. */
export type ModelEnd = { family: FamilyId; at: Anchor };

/** One step between two efforts of a model under the shown pricing. */
export type EffortStep = Segment & {
	key: string;
	seriesId: string;
	family: FamilyId;
	/** Both ends are worth weighing. */
	worthWeighing: boolean;
};

/** A gridline, keyed by its axis and tick value so it survives a drag. */
export type GridLine = Segment & { key: string };

/**
 * Everything the trade-off chart draws for one camera angle, already on the
 * SVG: the floor and wall gridlines, the three axes, the labels of the axes
 * not seen end-on, each effort line, and the points from back to front.
 */
export type TradeoffScene = {
	floorGrid: GridLine[];
	wallGrid: GridLine[];
	axes: Record<AxisId, Segment>;
	tickLabels: TickLabel[];
	/** Where each labelled axis's title goes: past its end. */
	axisTitles: Partial<Record<AxisId, Anchor>>;
	efforts: EffortStep[];
	modelEnds: ModelEnd[];
	/** Far to near, so nearer points paint over farther ones. */
	points: ScenePoint[];
};

const AXIS_IDS = Object.keys(AXES) as AxisId[];

export function tradeoffScene(
	points: readonly [TimedPoint, ...TimedPoint[]],
	angles: Angles,
	viewport: Viewport,
): TradeoffScene {
	const space = plotSpace(points);
	const positions = points.map((point) => space.position(point));
	// The points too: a high one over the far corner rises above the frame.
	const camera = fitCamera(angles, [...FRAME_ANCHORS, ...positions], viewport);
	const frontier = tradeoffFrontier(points);
	const scenePoints = points
		.map((point, i) => {
			const [x, y, z] = positions[i];
			return {
				point,
				at: project([x, y, z], camera),
				floor: project([x, y, 0], camera),
				worthWeighing: frontier.has(point),
			};
		})
		.sort((a, b) => a.at.depth - b.at.depth);
	const labelled = AXIS_IDS.filter((id) => isLabelled(id, camera));
	const ticks = axisTicks(space.ticks);
	return {
		floorGrid: [
			...ticks.cost.map(({ key, at: y }) =>
				gridLine(key, [-1, y, 0], [1, y, 0], camera),
			),
			...ticks.minutes.map(({ key, at: x }) =>
				gridLine(key, [x, -1, 0], [x, 1, 0], camera),
			),
		],
		wallGrid: ticks.score.map(({ key, at: z }) =>
			gridLine(key, [-1, -1, z], [-1, 1, z], camera),
		),
		axes: {
			minutes: segment(...AXES.minutes, camera),
			cost: segment(...AXES.cost, camera),
			score: segment(...AXES.score, camera),
		},
		tickLabels: labelled.flatMap((id) => tickLabels(id, space.ticks, camera)),
		axisTitles: Object.fromEntries(
			labelled.map((id) => [id, project(AXES[id][1], camera)]),
		),
		efforts: effortSteps(scenePoints),
		modelEnds: modelEnds(scenePoints),
		points: scenePoints,
	};
}

function isLabelled(id: AxisId, camera: Camera): boolean {
	const [start, end] = AXES[id];
	return projectedLength(start, end, camera) >= MIN_LABELLED_AXIS_PX;
}

function segment(a: Vec3, b: Vec3, camera: Camera): Segment {
	const start = project(a, camera);
	const end = project(b, camera);
	return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

function gridLine(key: string, a: Vec3, b: Vec3, camera: Camera): GridLine {
	return { key, ...segment(a, b, camera) };
}

type GridTick = { key: string; at: number };

type Ticks = ReturnType<typeof plotSpace>["ticks"];

/** Each tick's coordinate on its own axis, in plot units. */
function axisTicks(ticks: Ticks): Record<AxisId, GridTick[]> {
	const tick = (id: AxisId, t: Ticks[AxisId][number], offset: number) => ({
		key: `${id}-${t.value}`,
		at: offset + t.at,
	});
	return {
		minutes: ticks.minutes.map((t) => tick("minutes", t, -1)),
		cost: ticks.cost.map((t) => tick("cost", t, -1)),
		score: ticks.score.map((t) => tick("score", t, 0)),
	};
}

/** Where a tick sits on its axis, and how its label stands off it (px). */
const TICK_PLACEMENT = {
	minutes: {
		at: (v: number): Vec3 => [-1 + v, -1, 0],
		dx: -9,
		dy: 4,
		anchor: "end",
	},
	cost: {
		at: (v: number): Vec3 => [-1, -1 + v, 0],
		dx: 0,
		dy: 19,
		anchor: "middle",
	},
	score: {
		at: (v: number): Vec3 => [-1, -1, v],
		dx: -9,
		dy: 4,
		anchor: "end",
	},
} as const;

const TICK_TEXT: Record<AxisId, (value: number) => string> = {
	minutes: String,
	cost: formatUsd,
	score: String,
};

function tickLabels(id: AxisId, ticks: Ticks, camera: Camera): TickLabel[] {
	const placement = TICK_PLACEMENT[id];
	return ticks[id].map((tick) => {
		const at = project(placement.at(tick.at), camera);
		return {
			key: `${id}-${tick.value}`,
			x: at.x + placement.dx,
			y: at.y + placement.dy,
			text: TICK_TEXT[id](tick.value),
			anchor: placement.anchor,
		};
	});
}

/** Joins each model's efforts in order, low to high, under one pricing. */
function effortSteps(points: readonly ScenePoint[]): EffortStep[] {
	// Points arrive depth-sorted; the series' own order is effort order.
	const bySeries = Map.groupBy(
		[...points].sort(
			(a, b) => a.point.benchmark.effortOrder - b.point.benchmark.effortOrder,
		),
		(p) => p.point.seriesId,
	);
	return [...bySeries.values()].flatMap((series) =>
		series.slice(1).map((end, i) => {
			const start = series[i];
			return {
				key: `${end.point.seriesId}/${end.point.benchmark.id}`,
				seriesId: end.point.seriesId,
				family: end.point.benchmark.family,
				x1: start.at.x,
				y1: start.at.y,
				x2: end.at.x,
				y2: end.at.y,
				worthWeighing: start.worthWeighing && end.worthWeighing,
			};
		}),
	);
}

function modelEnds(points: readonly ScenePoint[]): ModelEnd[] {
	const byFamily = Map.groupBy(points, (p) => p.point.benchmark.family);
	return [...byFamily].map(([family, members]) => ({
		family,
		at: members.reduce((a, b) => (b.at.x > a.at.x ? b : a)).at,
	}));
}
