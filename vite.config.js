import { defineConfig } from "vite";

export default defineConfig({
	base: "/open-slots/", // <-- set to your repo name
	build: {
		outDir: "dist",
		sourcemap: true
	}
});
