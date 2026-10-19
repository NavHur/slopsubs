export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/**
 * Runs in <head> before first paint so a stored choice applies to the
 * prerendered page without a flash; with nothing stored, CSS follows
 * prefers-color-scheme.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function currentTheme(): Theme {
	const chosen = document.documentElement.dataset.theme;
	if (chosen === "light" || chosen === "dark") return chosen;
	return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Flips the theme on screen and remembers the choice. */
export function toggleTheme(): void {
	const next: Theme = currentTheme() === "dark" ? "light" : "dark";
	document.documentElement.dataset.theme = next;
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// Storage is blocked, so the choice lasts only for this page.
	}
}
