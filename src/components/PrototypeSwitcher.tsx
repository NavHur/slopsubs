// PROTOTYPE, throwaway: cycles the comparison tooltip variants. Arrow keys
// cycle too, unless a field or the 3D chart (which turns on arrows) has focus.
import { useEffect } from "react";
import {
	setVariant,
	useVariant,
	VARIANTS,
} from "./chart/PointComparison.prototype";

export function PrototypeSwitcher() {
	const variant = useVariant();
	const index = VARIANTS.findIndex((v) => v.key === variant);
	const step = (by: number) => {
		const next = VARIANTS[(index + by + VARIANTS.length) % VARIANTS.length];
		if (next) setVariant(next.key);
	};
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target && target !== document.body) return;
			if (e.key === "ArrowLeft") step(-1);
			if (e.key === "ArrowRight") step(1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	const current = VARIANTS[index];
	return (
		<div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#ff2d87] px-1.5 py-1 text-[13px] font-semibold text-white shadow-[0_6px_20px_rgb(0_0_0/0.4)]">
			<button
				type="button"
				aria-label="Previous variant"
				onClick={() => step(-1)}
				className="grid size-7 place-items-center rounded-full hover:bg-white/20"
			>
				←
			</button>
			<span className="min-w-64 px-2 text-center">
				Prototype {current?.key}: {current?.name}
			</span>
			<button
				type="button"
				aria-label="Next variant"
				onClick={() => step(1)}
				className="grid size-7 place-items-center rounded-full hover:bg-white/20"
			>
				→
			</button>
		</div>
	);
}
