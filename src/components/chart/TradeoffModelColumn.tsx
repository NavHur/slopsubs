import type { FamilyId } from "#/domain/model";
import { spreadLabels } from "#/lib/chart";
import { ModelTag } from "./ChartParts";
import { LABEL_GAP } from "./geometry";
import type { HighlightEvent } from "./highlight";
import { isFaded, type LitModels } from "./litModels";
import type { Viewport } from "./projection";
import type { ModelGroup } from "./series";
import { hasModelColumn, type TradeoffScene } from "./tradeoffScene";

/** Gap between the plot's right edge and the model names (px). */
const COLUMN_GAP_PX = 24;

/** Each model's name and where its line ends, spread so no names overlap. */
function modelLabels(scene: TradeoffScene, viewport: Viewport) {
	const { height, padding } = viewport;
	return spreadLabels({
		anchors: scene.modelEnds.map(({ family, at }) => ({
			id: family,
			anchorY: at.y,
			end: at,
		})),
		gap: LABEL_GAP,
		top: padding.top,
		bottom: height - padding.bottom,
	});
}

/**
 * The model names in a column right of the plot, each tied to its line's end;
 * on a narrow chart the legend below stands in, so this draws nothing.
 */
export function TradeoffModelColumn({
	scene,
	viewport,
	models,
	lit,
	pinnedModel,
	onHighlight,
}: {
	scene: TradeoffScene;
	viewport: Viewport;
	models: readonly ModelGroup[];
	/** The models that stay lit; the rest fade. */
	lit: LitModels;
	pinnedModel: FamilyId | null;
	onHighlight: (event: HighlightEvent) => void;
}) {
	if (!hasModelColumn(viewport.width)) return null;
	const x = viewport.width - viewport.padding.right + COLUMN_GAP_PX;
	return modelLabels(scene, viewport).map(({ id, end, y }) => {
		const model = models.find((m) => m.id === id);
		return (
			model && (
				<ModelTag
					key={id}
					model={model}
					from={[end.x, end.y]}
					at={[x, y]}
					dimmed={isFaded(lit, id)}
					pinned={pinnedModel === id}
					onHighlight={onHighlight}
				/>
			)
		);
	});
}
