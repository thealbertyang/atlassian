/**
 * Internal query parameters injected by the VS Code webview wrapper.
 * These are not app-owned state and must be stripped when parsing links.
 */
export const INTERNAL_WRAPPER_QUERY_KEYS = [
  "id",
  "parentid",
  "origin",
  "swversion",
  "extensionid",
  "platform",
  "vscode-resource-base-authority",
  "parentorigin",
] as const;

const WRAPPER_KEY_SET = new Set(
  INTERNAL_WRAPPER_QUERY_KEYS.map((k) => k.toLowerCase()),
);

/** Returns true when `key` is an internal wrapper param (case-insensitive, or has `vscode-` prefix). */
export const isInternalWrapperQueryKey = (key: string): boolean => {
  const normalized = String(key ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("vscode-")) return true;
  return WRAPPER_KEY_SET.has(normalized);
};