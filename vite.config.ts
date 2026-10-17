import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		tailwindcss(),
		// The site is static data, so every page is prerendered and served as
		// plain assets from a Cloudflare Worker.
		tanstackStart({ prerender: { enabled: true, crawlLinks: true } }),
		viteReact(),
	],
});

export default config;
