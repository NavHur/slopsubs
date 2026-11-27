import { Data, Effect } from "effect";

export class PlanDataError extends Data.TaggedError("PlanDataError")<{
	message: string;
}> {}

/** A limited-time plan stops shipping once its offer has ended. */
export const checkOffers = Effect.fnUntraced(function* (
	research: readonly { planId: string; offerEndsOn?: string }[],
	today: string,
) {
	for (const { planId, offerEndsOn } of research)
		if (offerEndsOn !== undefined && offerEndsOn < today)
			return yield* new PlanDataError({
				message: `${planId}: the offer ended on ${offerEndsOn}; delete the plan and its id in plan-families.ts, build-plans.ts and tests, then rebuild.`,
			});
});
