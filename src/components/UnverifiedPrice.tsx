import type { ReactNode } from "react";
import type { Plan } from "#/domain/model";

/** A plan's price text, starred with a tooltip when its sources aren't primary. */
export function UnverifiedPrice({
	plan,
	children,
}: {
	plan: Plan;
	children: ReactNode;
}) {
	const verified = plan.confidence === "primary";
	return (
		<span
			title={verified ? undefined : `Price from ${plan.confidence} sources`}
		>
			{children}
			{verified ? "" : "*"}
		</span>
	);
}
