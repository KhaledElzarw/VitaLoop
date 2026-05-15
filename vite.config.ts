import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
        popup: new URL("./extension/popup.html", import.meta.url).pathname,
        options: new URL("./extension/options.html", import.meta.url).pathname,
        background: new URL("./src/extension/background.ts", import.meta.url)
          .pathname,
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "background"
            ? "extension/background.js"
            : "assets/[name]-[hash].js",
      },
    },
  },
});
