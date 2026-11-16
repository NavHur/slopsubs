import type { BenchmarkView } from "#/lib/benchmarks";
import { formatDay } from "#/lib/format";

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

/** Where the benchmark scores and plan caps come from, and when a refresh last
 * changed any of the site's data (one that changes nothing keeps the old date). */
export function PageFooter({
	benchmark,
	fetchedAt,
}: {
	benchmark: BenchmarkView;
	fetchedAt: string;
}) {
	return (
		<footer className="mt-auto flex flex-wrap justify-between gap-x-6 border-t border-line px-4 py-3 text-[12px] leading-5 text-muted sm:px-7">
			<span>
				Data from{" "}
				<FooterLink href={benchmark.source.url}>
					{benchmark.source.name}
				</FooterLink>{" "}
				{benchmark.costSource && (
					<>
						· costs from{" "}
						<FooterLink href={benchmark.costSource.url}>
							{benchmark.costSource.name}
						</FooterLink>{" "}
					</>
				)}
				· estimated caps from{" "}
				<FooterLink
					href="https://www.youtube.com/watch?v=nYA0yASgaZI"
					title="Weekly caps from Theo's numbers until we measure them"
				>
					Theo
				</FooterLink>{" "}
				and{" "}
				<FooterLink
					href="https://docs.z.ai/devpack/overview"
					title="Z.ai's weekly credits and per-token credit rates, valued at list price"
				>
					Z.ai's credit rates
				</FooterLink>
			</span>
			<time
				dateTime={fetchedAt}
				title="When the site's data last changed"
				className="text-subtle"
			>
				Data as of {formatDay(fetchedAt)}
			</time>
		</footer>
	);
}
