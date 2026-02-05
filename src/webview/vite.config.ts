import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react-swc";
import vscodeWebviewHmr from "vite-plugin-vscode-webview-hmr";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig(({ command }) => {
  const isServe = command === "serve";

  return {
    root: resolve(__dirname),
    appType: "spa",
    base: isServe ? "/" : "./",
    environments: {
      client: {},
    },
    plugins: [
      isServe
        ? tanstackStart({
            spa: {
              enabled: true,
              prerender: {
                outputPath: "/index.html",
              },
            },
          })
        : tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
          }),
      isServe ? vscodeWebviewHmr() : undefined,
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "..", "shared"),
      },
    },
    build: {
      outDir: "../../out/webview",
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      strictPort: true,
      cors: true,
      fs: {
        allow: [resolve(__dirname, "..")],
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
      hmr: {
        protocol: "ws",
        host: "localhost",
        port: 5173,
      },
    },
  };
});
