import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Force Nitro's node-server preset so the VPS build produces a Node-compatible
// server entry (dist/server/index.mjs) that scripts/node-adapter.mjs can serve
// with PM2. The default Lovable build uses cloudflare-module for previews/publishing.
const forceNodePreset = (): Plugin => ({
  name: "force-node-preset",
  enforce: "pre",
  config(config: any) {
    // Set the preset before the TanStack Start plugin reads it.
    if (config?.tanstackStart?.server) {
      config.tanstackStart.server.preset = "node-server";
    }
  },
  configResolved(config: any) {
    // Belt-and-suspenders: override after resolution too.
    if (config?.tanstackStart?.server) {
      config.tanstackStart.server.preset = "node-server";
    }
    const tsPlugin = config.plugins?.find(
      (p: any) => p?.name === "tanstack-start-vite" || p?.name === "tanstack-start"
    );
    if (tsPlugin?.api?.options?.server) {
      tsPlugin.api.options.server.preset = "node-server";
    }
    // Nitro stores its resolved options on the config under "nitro"
    if (config?.nitro) {
      config.nitro.preset = "node-server";
    }
  },
});

export default defineConfig({
  tanstackStart: {
    server: { entry: "server", preset: "node-server" },
  },
  vite: {
    plugins: [forceNodePreset()],
  },
});
