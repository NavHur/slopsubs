import { Data } from "effect";

export class AaImportError extends Data.TaggedError("AaImportError")<{
	message: string;
	cause?: unknown;
}> {}
