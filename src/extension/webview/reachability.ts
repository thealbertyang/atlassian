import * as http from "http";
import * as https from "https";

export function getDevServerPort(url: string): number {
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      return Number(parsed.port);
    }
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return 0;
  }
}

export function isDevServerReachable(url: string, timeoutMs = 350): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const requester = parsed.protocol === "https:" ? https : http;
      const req = requester.request(
        {
          method: "GET",
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: parsed.pathname || "/",
        },
        (res) => {
          res.resume();
          resolve(Boolean(res.statusCode && res.statusCode < 500));
        },
      );
      req.on("error", () => resolve(false));
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

export async function waitForDevServer(
  url: string,
  attempts: number,
  delayMs: number,
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    if (await isDevServerReachable(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}
