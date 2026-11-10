import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vite-plus/test";
import { observeDismissal } from "./HeaderActions";

// Node has no DOM: a minimal document records listeners and dispatches to them.
type Listener = (event: never) => void;

function fakeDocument() {
	const listeners = new Map<string, Set<Listener>>();
	return {
		addEventListener: (type: string, fn: Listener) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)?.add(fn);
		},
		removeEventListener: (type: string, fn: Listener) => {
			listeners.get(type)?.delete(fn);
		},
		dispatch: (type: string, event: object) => {
			for (const fn of listeners.get(type) ?? []) fn(event as never);
		},
	};
}

class FakeNode {}

describe("observeDismissal", () => {
	const inside = new FakeNode();
	const outside = new FakeNode();
	const root = { current: { contains: (n: unknown) => n === inside } };
	let doc: ReturnType<typeof fakeDocument>;
	let close: Mock<() => void>;
	let focus: Mock<() => void>;
	let stop: () => void;

	beforeEach(() => {
		vi.stubGlobal("Node", FakeNode);
		doc = fakeDocument();
		vi.stubGlobal("document", doc);
		close = vi.fn<() => void>();
		focus = vi.fn<() => void>();
		stop = observeDismissal(
			root as never,
			{ current: { focus } } as never,
			close,
		);
	});
	afterEach(() => vi.unstubAllGlobals());

	const escape = () => ({ key: "Escape", stopPropagation: vi.fn() });

	it.each(["pointerdown", "focusin"])("closes on %s outside", (type) => {
		doc.dispatch(type, { target: outside });
		expect(close).toHaveBeenCalledTimes(1);
	});

	it.each(["pointerdown", "focusin"])("stays open on %s inside", (type) => {
		doc.dispatch(type, { target: inside });
		expect(close).not.toHaveBeenCalled();
	});

	it("closes on Escape, refocuses the trigger and stops it propagating", () => {
		const event = escape();
		doc.dispatch("keydown", event);
		expect(close).toHaveBeenCalledTimes(1);
		expect(focus).toHaveBeenCalledTimes(1);
		expect(event.stopPropagation).toHaveBeenCalledTimes(1);
	});

	it("ignores other keys", () => {
		const event = { key: "a", stopPropagation: vi.fn() };
		doc.dispatch("keydown", event);
		expect(close).not.toHaveBeenCalled();
		expect(event.stopPropagation).not.toHaveBeenCalled();
	});

	it("stops reacting once cleaned up", () => {
		stop();
		const event = escape();
		doc.dispatch("pointerdown", { target: outside });
		doc.dispatch("focusin", { target: outside });
		doc.dispatch("keydown", event);
		expect(close).not.toHaveBeenCalled();
		expect(focus).not.toHaveBeenCalled();
		expect(event.stopPropagation).not.toHaveBeenCalled();
	});
});
