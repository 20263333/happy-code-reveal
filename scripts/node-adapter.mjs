#!/usr/bin/env node
// Node.js adapter for the Cloudflare-module Nitro build produced by
// `bun run build:vps`. Serves the app on a VPS behind Nginx/PM2.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Nitro writes either dist/ or .output/ depending on version/preset.
const candidates = [
  { dist: path.resolve(root, "dist"), client: path.resolve(root, "dist/client"), server: path.resolve(root, "dist/server/index.mjs") },
  { dist: path.resolve(root, ".output"), client: path.resolve(root, ".output/public"), server: path.resolve(root, ".output/server/index.mjs") },
];
const build = candidates.find((c) => fs.existsSync(c.server));
if (!build) {
  console.error("[node-adapter] build output not found — run `bun run build:vps` first");
  process.exit(1);
}
const distDir = build.dist;
const clientDir = build.client;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Node.js < 22 has no global WebSocket; @supabase/supabase-js refuses to start
// its realtime client without one. Polyfill it from `ws` before loading the app.
if (typeof globalThis.WebSocket === "undefined") {
  try {
    const { default: WS } = await import("ws");
    globalThis.WebSocket = WS;
    console.log("[node-adapter] WebSocket polyfill from `ws` installed (Node " + process.versions.node + ")");
  } catch {
    console.warn("[node-adapter] `ws` package missing — realtime features may fail on Node < 22");
  }
}

const worker = await import(build.server).then((m) => m.default);

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

const ASSETS = {
  async fetch(request) {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    let filePath = path.join(clientDir, rel);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(clientDir, "index.html");
    }
    if (!fs.existsSync(filePath)) {
      return new Response("Not found", { status: 404 });
    }

    const data = await fs.promises.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "content-type": contentTypeFor(filePath),
        "cache-control": rel.startsWith("/_assets/") || rel.includes(".")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=0, must-revalidate",
      },
    });
  },
};

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function nodeRequestToWebRequest(req) {
  const url = `http://${req.headers.host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, String(value));
    }
  }

  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await collectBody(req);
    init.body = body.length > 0 ? body : undefined;
  }
  return new Request(url, init);
}

const server = http.createServer(async (req, res) => {
  try {
    const request = await nodeRequestToWebRequest(req);
    const response = await worker.fetch(request, { ASSETS }, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key === "set-cookie") {
        res.setHeader(key, value.split(", "));
      } else {
        res.setHeader(key, value);
      }
    });

    const body = await response.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (err) {
    console.error("[node-adapter] error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
server.listen(port, "127.0.0.1", () => {
  console.log(`PLATFORM.TJ server listening on http://127.0.0.1:${port}`);
});

// Keep the Sales Partner card synchronized even when nobody has the dashboard
// open. The protected local endpoint computes a fresh server-side snapshot and
// sends it to the second application. Never overlap slow network requests.
const partnerSyncSecret = process.env.SALES_PARTNER_WEBHOOK_SECRET;
let partnerSyncBusy = false;
let lastPartnerSyncError = "";

async function synchronizeSalesPartner() {
  if (!partnerSyncSecret || partnerSyncBusy) return;
  partnerSyncBusy = true;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/public/hooks/partner-sync`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cron-secret": partnerSyncSecret,
      },
      body: "{}",
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${body.slice(0, 300)}`);
    const result = JSON.parse(body);
    const failed = Array.isArray(result.results)
      ? result.results.filter((item) => !item.ok)
      : [];
    if (failed.length) throw new Error(failed.map((item) => item.error || item.company).join("; "));
    if (lastPartnerSyncError) console.log("[partner-sync] connection restored");
    lastPartnerSyncError = "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== lastPartnerSyncError) console.error("[partner-sync] failed:", message);
    lastPartnerSyncError = message;
  } finally {
    partnerSyncBusy = false;
  }
}

if (partnerSyncSecret) {
  const firstPartnerSync = setTimeout(() => void synchronizeSalesPartner(), 1_000);
  firstPartnerSync.unref();
  const partnerSyncTimer = setInterval(() => void synchronizeSalesPartner(), 3_000);
  partnerSyncTimer.unref();
  console.log("[partner-sync] server synchronization enabled (every 3 seconds)");
} else {
  console.warn("[partner-sync] SALES_PARTNER_WEBHOOK_SECRET is missing; server synchronization is disabled");
}
