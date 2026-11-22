import { Data, Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

export class RemoteStatusError extends Data.TaggedError("RemoteStatusError")<{
	url: string;
	status: number;
}> {
	override get message() {
		return `${this.url}: HTTP ${this.status}`;
	}
}

function acceptsStatus(status: number, rejectRedirects: boolean) {
	return rejectRedirects ? status === 200 : status >= 200 && status < 300;
}

export function getText(
	url: string,
	options: { headers?: HeadersInit; rejectRedirects?: boolean } = {},
) {
	const request = HttpClient.get(url, { headers: options.headers });
	const manual = options.rejectRedirects === true;
	return Effect.gen(function* () {
		const response = yield* manual
			? request.pipe(
					Effect.provideService(FetchHttpClient.RequestInit, {
						redirect: "manual",
					}),
				)
			: request;
		if (!acceptsStatus(response.status, manual))
			return yield* new RemoteStatusError({ url, status: response.status });
		return yield* response.text;
	});
}
