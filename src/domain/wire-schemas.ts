import { Schema } from "effect";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIME =
	/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?Z$/;

function isCalendarDate(value: string): boolean {
	const date = new Date(value + "T00:00:00Z");
	return (
		Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)
	);
}

export const IsoDate = Schema.String.check(
	Schema.isPattern(DATE),
	Schema.makeFilter(
		(value) => isCalendarDate(value) || "Expected a calendar date",
	),
);

export const UtcTimestamp = Schema.String.check(
	Schema.isPattern(UTC_TIME),
	Schema.makeFilter(
		(value) => isCalendarDate(value.slice(0, 10)) || "Expected a calendar date",
	),
);

export const UrlString = Schema.String.check(
	Schema.makeFilter((value) => URL.canParse(value) || "Expected a URL"),
);
