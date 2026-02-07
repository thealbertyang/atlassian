import type { UrlStateConfig, UrlStateParam } from "../universal/types";

/**
 * Check whether a value is valid for a given URL state parameter.
 */
export function validateUrlParam(key: string, value: string, config: UrlStateConfig): boolean {
  const param: UrlStateParam | undefined = config[key];
  if (!param) {
    return false;
  }

  switch (param.type) {
    case "enum":
      return param.values ? param.values.includes(value) : true;
    case "boolean":
      return value === "true" || value === "false";
    case "number":
      return value !== "" && !Number.isNaN(Number(value));
    case "string":
      return true;
    default:
      return false;
  }
}

/**
 * Filter a params record to only known keys, dropping invalid values and
 * filling in defaults for missing params that have one.
 */
export function sanitizeUrlState(
  params: Record<string, string>,
  config: UrlStateConfig,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, param] of Object.entries(config)) {
    const value = params[key];
    if (value !== undefined && validateUrlParam(key, value, config)) {
      result[key] = value;
    } else if (param.default !== undefined) {
      result[key] = param.default;
    }
  }

  return result;
}

/**
 * Return default values for every param that declares one.
 */
export function getUrlStateDefaults(config: UrlStateConfig): Record<string, string> {
  const defaults: Record<string, string> = {};

  for (const [key, param] of Object.entries(config)) {
    if (param.default !== undefined) {
      defaults[key] = param.default;
    }
  }

  return defaults;
}

/**
 * Build omnibox / autocomplete hint objects for known URL state params.
 * Optionally filter by route (currently unused; reserved for future per-route scoping).
 */
export function getOmniboxHints(
  config: UrlStateConfig,
  _route?: string,
): Array<{ key: string; values?: string[]; description?: string }> {
  return Object.entries(config).map(([key, param]) => ({
    key,
    ...(param.values ? { values: param.values } : {}),
    ...(param.description ? { description: param.description } : {}),
  }));
}