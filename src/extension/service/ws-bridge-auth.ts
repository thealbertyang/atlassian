import { randomBytes } from "crypto";
import type { StorageService } from "./storage-service";
import { WS_BRIDGE_TOKEN_KEY } from "../constants";

/**
 * WS bridge auth is intended for local/dev use (browser -> extension host).
 * We support:
 * - env override (ATLASSIAN_WS_BRIDGE_TOKEN)
 * - persisted token in global state (for easy reuse)
 * - auto-generated token if neither exist
 */
export const getOrCreateWsBridgeToken = (storage: StorageService): string => {
  const envToken = (process.env.ATLASSIAN_WS_BRIDGE_TOKEN ?? "").trim();
  const storedToken = (storage.getGlobalState<string>(WS_BRIDGE_TOKEN_KEY) ?? "").trim();

  let token = envToken || storedToken;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    void storage.setGlobalState(WS_BRIDGE_TOKEN_KEY, token);
    return token;
  }

  if (envToken && envToken !== storedToken) {
    void storage.setGlobalState(WS_BRIDGE_TOKEN_KEY, token);
  }

  return token;
};

