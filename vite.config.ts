import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

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
			"src/data/**",
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
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		rules: {
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
		ignorePatterns: ["src/routeTree.gen.ts", "src/data/**"],
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
