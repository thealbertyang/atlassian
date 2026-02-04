import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs";

const devUrl = process.env.ATLASSIAN_WEBVIEW_DEV_SERVER_URL || "http://localhost:5173";
const parsed = new URL(devUrl);
const port = parsed.port ? Number(parsed.port) : 5173;
const host = parsed.hostname || "localhost";

const wantsHttps = parsed.protocol === "https:" || process.env.ATLASSIAN_WEBVIEW_DEV_HTTPS === "1";
const certPath =
  process.env.ATLASSIAN_WEBVIEW_DEV_CERT || resolve(__dirname, ".certs", "localhost.crt");
const keyPath =
  process.env.ATLASSIAN_WEBVIEW_DEV_KEY || resolve(__dirname, ".certs", "localhost.key");

let https: boolean | { cert: Buffer; key: Buffer } = false;
if (wantsHttps) {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    https = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  } else {
    https = true;
  }
}

export default defineConfig({
  root: __dirname,
  server: {
    host,
    port,
    strictPort: true,
    https,
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
