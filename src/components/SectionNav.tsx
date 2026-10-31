import type { MouseEvent } from "react";

/** Whether a click is a plain left click the page handles itself. */
export function isPlainPrimaryClick(
	event: Pick<
		MouseEvent,
		| "button"
		| "metaKey"
		| "ctrlKey"
		| "shiftKey"
		| "altKey"
		| "defaultPrevented"
	>,
): boolean {
	if (event.defaultPrevented || event.button !== 0) return false;
	return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

/** Links to the page's chart sections, marking the one in view. */
export function SectionNav<T extends string>({
	sections,
	active,
	hrefFor,
	onSelect,
}: {
	sections: readonly { id: T; label: string }[];
	active: T;
	/** Where a link opens the section when the page does not handle the click. */
	hrefFor: (id: T) => string;
	onSelect: (id: T) => void;
}) {
	const select = (event: MouseEvent, id: T) => {
		if (!isPlainPrimaryClick(event)) return;
		event.preventDefault();
		onSelect(id);
	};
	return (
		<nav
			aria-label="Charts"
			className="-mx-4 flex gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
		>
			{sections.map((section) => (
				<a
					key={section.id}
					href={hrefFor(section.id)}
					aria-current={section.id === active ? "location" : undefined}
					onClick={(event) => select(event, section.id)}
					className="-mb-px flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent text-[14px] text-muted transition-colors hover:text-fg aria-[current]:border-accent aria-[current]:font-medium aria-[current]:text-fg lg:min-h-0 lg:pt-3 lg:pb-2.5"
				>
					{section.label}
				</a>
			))}
		</nav>
	);
}
