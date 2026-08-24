import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const BACKEND = process.env.WORK4YOU_DASHBOARD_URL ?? "http://127.0.0.1:9119";
const DESKTOP_SRC = path.resolve(__dirname, "../apps/desktop/src");
const WEB_SRC = path.resolve(__dirname, "./src");

const requireFromWeb = createRequire(path.join(__dirname, "package.json"));

function resolveEmojibaseDir(): string | null {
  for (const candidate of [
    path.resolve(__dirname, "node_modules/emojibase-data"),
    path.resolve(__dirname, "../node_modules/emojibase-data"),
    path.resolve(__dirname, "../apps/desktop/node_modules/emojibase-data"),
  ]) {
    try {
      return fs.realpathSync(candidate);
    } catch {
      /* try next */
    }
  }
  return null;
}

const emojibaseDir = resolveEmojibaseDir();

const EMOJIBASE_PATH = /^[a-z-]+\/(data|messages|shortcodes\/emojibase)\.json$/;

function desktopChatAlias(): Plugin {
  const desktopImporter = /(?:^|\/)(?:apps\/desktop\/src|web\/src\/desktop-chat)\//;

  return {
    name: "work4you:desktop-chat-alias",
    enforce: "pre",
    resolveId(source, importer, options) {
      if (
        source === "@/desktop-chat/WebChatApp" ||
        source.endsWith("/desktop-chat/WebChatApp") ||
        source.endsWith("/desktop-chat/WebChatApp.ts") ||
        source.endsWith("/desktop-chat/WebChatApp.tsx")
      ) {
        return path.join(WEB_SRC, "desktop-chat/WebChatApp.runtime.tsx");
      }

      if (source.startsWith("@/")) {
        const normalizedImporter = importer?.replace(/\\/g, "/") ?? "";
        const fromDesktopGraph =
          desktopImporter.test(normalizedImporter) || source.startsWith("@desktop/");

        if (fromDesktopGraph) {
          if (source.startsWith("@desktop/")) {
            return this.resolve(
              path.join(DESKTOP_SRC, source.slice("@desktop/".length)),
              importer,
              { ...options, skipSelf: true },
            );
          }
          return this.resolve(path.join(DESKTOP_SRC, source.slice(2)), importer, {
            ...options,
            skipSelf: true,
          });
        }

        return this.resolve(path.join(WEB_SRC, source.slice(2)), importer, {
          ...options,
          skipSelf: true,
        });
      }

      if (!importer) return null;
      const normalizedImporter = importer.replace(/\\/g, "/");
      const fromDesktopGraph =
        desktopImporter.test(normalizedImporter) || source.startsWith("@desktop/");

      if (source.startsWith("@desktop/")) {
        return this.resolve(
          path.join(DESKTOP_SRC, source.slice("@desktop/".length)),
          importer,
          { ...options, skipSelf: true },
        );
      }

      if (fromDesktopGraph && source === "@work4you/plugin-sdk") {
        return path.join(DESKTOP_SRC, "sdk/index.ts");
      }

      return null;
    },
  };
}

function emojibaseAssets(): Plugin {
  return {
    name: "work4you:emojibase-assets",
    configureServer(server) {
      server.middlewares.use("/emojibase", (req, res, next) => {
        const rel = (req.url ?? "").split("?")[0].replace(/^\/+/, "");
        if (!EMOJIBASE_PATH.test(rel) || !emojibaseDir) {
          return next();
        }
        fs.readFile(path.join(emojibaseDir, rel), (err, buf) => {
          if (err) return next();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.end(buf);
        });
      });
    },
    generateBundle() {
      if (!emojibaseDir) return;
      for (const rel of [
        "en/data.json",
        "en/messages.json",
        "en/shortcodes/emojibase.json",
      ]) {
        this.emitFile({
          type: "asset",
          fileName: `emojibase/${rel}`,
          source: fs.readFileSync(path.join(emojibaseDir, rel)),
        });
      }
    },
  };
}

/**
 * In production the Python `work4you dashboard` server injects a one-shot
 * session token into `index.html` (see `work4you_cli/web_server.py`). The
 * Vite dev server serves its own `index.html`, so unless we forward that
 * token, every protected `/api/*` call 401s.
 *
 * This plugin fetches the running dashboard's `index.html` on each dev page
 * load, scrapes the `window.__WORK4YOU_SESSION_TOKEN__` assignment, and
 * re-injects it into the dev HTML. No-op in production builds.
 */
function work4youDevToken(): Plugin {
  const TOKEN_RE = /window\.__WORK4YOU_SESSION_TOKEN__\s*=\s*"([^"]+)"/;
  const EMBEDDED_RE =
    /window\.__WORK4YOU_DASHBOARD_EMBEDDED_CHAT__\s*=\s*(true|false)/;

  return {
    name: "work4you:dev-session-token",
    apply: "serve",
    async transformIndexHtml() {
      try {
        const res = await fetch(BACKEND, { headers: { accept: "text/html" } });
        const html = await res.text();
        const match = html.match(TOKEN_RE);
        if (!match) {
          console.warn(
            `[work4you] Could not find session token in ${BACKEND} — ` +
              `is \`work4you dashboard\` running? /api calls will 401.`,
          );
          return;
        }
        const embeddedMatch = html.match(EMBEDDED_RE);
        const embeddedJs = embeddedMatch ? embeddedMatch[1] : "true";
        return [
          {
            tag: "script",
            injectTo: "head",
            children:
              `window.__WORK4YOU_SESSION_TOKEN__="${match[1]}";` +
              `window.__WORK4YOU_DASHBOARD_EMBEDDED_CHAT__=${embeddedJs};`,
          },
        ];
      } catch (err) {
        console.warn(
          `[work4you] Dashboard at ${BACKEND} unreachable — ` +
            `start it with \`work4you dashboard\` or set WORK4YOU_DASHBOARD_URL. ` +
            `(${(err as Error).message})`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [desktopChatAlias(), react(), tailwindcss(), work4youDevToken(), emojibaseAssets()],
  resolve: {
    alias: {
      "@desktop": DESKTOP_SRC,
      "@work4you/shared": path.resolve(__dirname, "../apps/shared/src"),
      "@work4you/shared/billing": path.resolve(
        __dirname,
        "../apps/shared/src/billing-types.ts",
      ),
      "@work4you/shared/translucency": path.resolve(
        __dirname,
        "../apps/shared/src/translucency.ts",
      ),
      "@work4you/plugin-sdk": path.join(DESKTOP_SRC, "sdk/index.ts"),
      ...((): Record<string, string> => {
        try {
          const driverRoot = path.dirname(requireFromWeb.resolve("driver.js"));
          const iife = path.join(driverRoot, "driver.js.iife.js");
          return {
            "driver.js/dist/driver.js.iife.js?raw": `${iife}?raw`,
            "driver.js/dist/driver.js.iife.js": iife,
          };
        } catch {
          return {};
        }
      })(),
    },
    // When @work4you/ui is symlinked via `workspace package @work4you/ui`,
    // Node's module resolution would pick up shared deps from
    // design-language/node_modules/*, giving us two copies + breaking
    // hooks (useRef-of-null), webgl contexts, etc. Force everything that
    // exists in BOTH places to use the dashboard's copy.
    //
    // Don't list packages here that only exist in the DS (nanostores,
    // @nanostores/react) — Vite dedupe errors out when it can't find
    // them at the project root.
    dedupe: [
      "react",
      "react-dom",
      "react-router",
      "@react-three/fiber",
      "@observablehq/plot",
      "three",
      "leva",
      "gsap",
      "nanostores",
      "@nanostores/react",
      "@tanstack/react-query",
    ],
  },
  build: {
    outDir: "../work4you_cli/web_dist",
    emptyOutDir: true,
    // Shell stays a bit over Vite's 500 kB default after vendor splits;
    // page/xterm chunks load on demand. Keep a modest ceiling so a true
    // regression still warns.
    chunkSizeWarningLimit: 600,
    // Split heavy vendors so the first dashboard paint does not download
    // xterm/three/plot/etc. until a route actually needs them. Lazy page
    // imports in App.tsx create the route boundaries; these groups keep
    // shared node_modules out of every page chunk.
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router)([\\/]|$)/,
            },
            {
              name: "desktop-chat",
              test: /(?:apps[\\/]desktop[\\/]src|web[\\/]src[\\/]desktop-chat)[\\/]/,
            },
            {
              name: "xterm",
              test: /node_modules[\\/]@xterm[\\/]/,
            },
            {
              name: "three",
              test: /node_modules[\\/](three|@react-three)([\\/]|$)/,
            },
            {
              name: "plot",
              test: /node_modules[\\/]@observablehq[\\/]plot([\\/]|$)/,
            },
            {
              name: "motion",
              test: /node_modules[\\/](motion|framer-motion)([\\/]|$)/,
            },
            {
              name: "ui",
              test: /node_modules[\\/]@work4you-research[\\/]ui([\\/]|$)/,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), WEB_SRC, DESKTOP_SRC],
    },
    proxy: {
      "/api": {
        target: BACKEND,
        ws: true,
      },
      // Same host as `work4you dashboard` must serve these; Vite has no
      // dashboard-plugins/* files, so without this, plugin scripts 404
      // or receive index.html in dev.
      "/dashboard-plugins": BACKEND,
    },
  },
});
