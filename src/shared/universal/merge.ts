import type { UniversalConfig } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const mergeObjects = (base: Record<string, unknown>, override: Record<string, unknown>) => {
  const result: Record<string, unknown> = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = mergeObjects(existing, value);
      return;
    }
    result[key] = value;
  });
  return result;
};

export const mergeUniversalConfig = (
  base: UniversalConfig,
  override?: Partial<UniversalConfig>,
): UniversalConfig => {
  if (!override) {
    return base;
  }
  return mergeObjects(base as Record<string, unknown>, override as Record<string, unknown>) as UniversalConfig;
};
