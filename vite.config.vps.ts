import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Override the Nitro preset to node-server after the Lovable config resolves.
// This lets the same app run on a VPS with PM2 while keeping the default
// cloudflare build intact for Lovable previews/publishing.
const forceNodePreset = (): Plugin => ({
  name: "force-node-preset",
  enforce: "post",
  configResolved(config: any) {
    // The TanStack Start plugin stores its options on the Vite config.
    if (config?.tanstackStart?.server) {
      config.tanstackStart.server.preset = "node-server";
    }
    // Some versions nest it under plugin options.
    const tsPlugin = config.plugins?.find(
      (p: any) => p?.name === "tanstack-start-vite" || p?.name === "tanstack-start"
    );
    if (tsPlugin?.api?.options?.server) {
      tsPlugin.api.options.server.preset = "node-server";
    }
  },
});

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [forceNodePreset()],
  },
});
