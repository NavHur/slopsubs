// Reads the positional arguments of `measure mark`.

import { Schema } from "effect";
import { GaugePercent } from "./claude-usage.ts";

/** A blank string is not 0: `Number("")` is, so reject it before converting. */
const UsedPercent = Schema.Trim.check(Schema.isNonEmpty()).pipe(
	Schema.decodeTo(Schema.FiniteFromString.check(GaugePercent)),
);

export const MarkArgs = Schema.Tuple([
	Schema.NonEmptyString,
	UsedPercent,
	Schema.DateFromString.check(
		Schema.makeFilter(
			(date) => Number.isFinite(date.getTime()) || "Expected a reset time",
		),
	),
]).annotate({ title: "measure mark <planId> <usedPercent> <resetsAt>" });
