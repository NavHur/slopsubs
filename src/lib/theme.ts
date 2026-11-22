import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const THEMES = ["light", "dark"] as const;
const Theme = Schema.Literals(THEMES);
type Theme = typeof Theme.Type;

const STORAGE_KEY = "theme";

/**
 * Runs in <head> before first paint so a stored choice applies to the
 * prerendered page without a flash; with nothing stored, CSS follows
 * prefers-color-scheme.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(${JSON.stringify(THEMES)}.includes(t))document.documentElement.dataset.theme=t}catch(e){}`;

const decodeTheme = Schema.decodeUnknownOption(Theme);

class ThemeStorageError extends Data.TaggedError("ThemeStorageError")<{
	cause: unknown;
}> {}

class ThemeStorage extends Context.Service<
	ThemeStorage,
	{
		readonly save: (theme: Theme) => Effect.Effect<void, ThemeStorageError>;
	}
>()("slopsubs/ThemeStorage") {
	static readonly layer = Layer.succeed(this, {
		save: (theme) =>
			Effect.try({
				try: () => localStorage.setItem(STORAGE_KEY, theme),
				catch: (cause) => new ThemeStorageError({ cause }),
			}),
	});
}

function currentTheme(): Theme {
	const chosen = decodeTheme(document.documentElement.dataset.theme);
	return Option.getOrElse(chosen, () =>
		matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
	);
}

const toggle = Effect.gen(function* () {
	const next: Theme = currentTheme() === "dark" ? "light" : "dark";
	document.documentElement.dataset.theme = next;
	const storage = yield* ThemeStorage;
	yield* storage.save(next);
}).pipe(
	// A blocked preference store still lets this page change theme.
	Effect.catchTag("ThemeStorageError", () => Effect.void),
	Effect.provide(ThemeStorage.layer),
);

/** Flips the theme on screen and remembers the choice. */
export function toggleTheme(): void {
	Effect.runSync(toggle);
}
