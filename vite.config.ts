import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

const config = defineConfig({
	run: {
		// Cached: a repeat build replays dist/ instead of rebuilding. Vite lists
		// dist/ before emptying it, so dist/ is left out of the inputs; a hit
		// then restores a deleted dist/ rather than missing.
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
		// The site is static data, so every page is prerendered and served as
		// plain assets from a Cloudflare Worker.
		tanstackStart({ prerender: { enabled: true, crawlLinks: true } }),
		viteReact(),
	]),
});

export default config;
