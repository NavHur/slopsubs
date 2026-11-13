import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

// Run type-aware rules and the type check on tsrs-lint instead of the tsgolint
// Vite+ bundles. Vite+ presets this variable before loading the config, so
// assign it: `??=` never takes effect.
process.env.OXLINT_TSGOLINT_PATH = fileURLToPath(
	new URL("./node_modules/.bin/tsrs-lint", import.meta.url),
);

const config = defineConfig({
	fmt: {
		useTabs: true,
		printWidth: 80,
		sortImports: {
			internalPattern: ["#/"],
			newlinesBetween: false,
			partitionByNewline: true,
		},
		ignorePatterns: [
			"src/routeTree.gen.ts",
			"src/styles.css",
			"src/data/*.json",
			"research/**",
			"measurements/**",
			"*.md",
			".cta.json",
			"package.json",
			"tsconfig.json",
			"tsr.config.json",
			"wrangler.jsonc",
		],
	},
	lint: {
		// Stands in for Biome's recommended set: oxlint's correctness category,
		// plus the recommended Biome rules it files under other categories.
		plugins: ["oxc", "typescript", "unicorn", "react", "jsx-a11y", "import"],
		categories: { correctness: "error" },
		jsPlugins: [
			{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
			{ name: "pbp", specifier: "./scripts/lint/cognitive-complexity.mjs" },
		],
		rules: {
			complexity: ["error", { max: 18 }],
			"pbp/cognitive-complexity": ["error", { max: 6 }],
			"vite-plus/prefer-vite-plus-imports": "error",
			eqeqeq: "error",
			"no-var": "error",
			"prefer-const": "error",
			"no-param-reassign": "error",
			"no-self-compare": "error",
			"no-useless-constructor": "error",
			"jsx-a11y/no-aria-hidden-on-focusable": "error",
			"react/button-has-type": "error",
			"react/no-array-index-key": "error",
			"react/no-danger": "error",
			"react/rules-of-hooks": "error",
			"typescript/no-explicit-any": "error",
			"typescript/no-inferrable-types": "error",
			"unicorn/prefer-node-protocol": "error",
		},
		overrides: [
			{
				// Classic zod and the schemas stay out of the client bundle; validate
				// at import (scripts/*, data.test.ts). zod/mini and types are fine.
				files: [
					"src/components/**",
					"src/routes/**",
					"src/lib/**",
					"src/data/index.ts",
					"src/domain/**",
				],
				rules: {
					"no-restricted-imports": [
						"error",
						{
							paths: ["zod", "zod/v3", "zod/v4", "zod/v4/classic"].map(
								(name) => ({
									name,
									message:
										"Use zod/mini: classic zod bloats the client bundle.",
								}),
							),
							patterns: [
								{
									group: ["#/domain/model", "**/domain/model*", "./model*"],
									allowTypeImports: true,
									message:
										"Import types only: the schemas stay out of the client.",
								},
							],
						},
					],
				},
			},
			{
				// The import side of src/domain parses with the schemas and never ships.
				files: [
					"src/domain/{model,catalog,aa-site,aa-evals,leaderboards,pricing}.ts",
					"**/*.test.ts",
					"**/*.test.tsx",
				],
				rules: { "no-restricted-imports": "off" },
			},
		],
		ignorePatterns: ["src/routeTree.gen.ts", "src/data/*.json"],
		// typeCheck makes lint report TypeScript's compiler errors, so it is the
		// repository's only type check.
		options: { typeAware: true, typeCheck: true },
	},
	run: {
		// Cached: a hit replays dist/. dist/ is left out of the inputs because Vite
		// lists it before emptying it, so a deleted dist/ restores from cache.
		tasks: {
			build: {
				command: "vp build",
				cache: { input: [{ auto: true }, "!dist/**"] },
			},
		},
	},
	resolve: { tsconfigPaths: true },
	plugins: lazyPlugins(() => [
		tailwindcss(),
		// Every page is prerendered as static assets; query strings are view
		// state on one page, so the crawler skips them (they would loop).
		tanstackStart({
			prerender: {
				enabled: true,
				crawlLinks: true,
				filter: ({ path }) => !path.includes("?"),
			},
		}),
		viteReact(),
	]),
});

export default config;
