// Minimal TOML parser used for small, human-edited config files in this repo.
// It intentionally supports only the subset we use (sections, simple key/value, arrays,
// and inline tables). If we outgrow this, replace with a real TOML parser.

const parseInlineTable = (raw: string): Record<string, unknown> | null => {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) {
    return {};
  }

  const parts: string[] = [];
  let current = "";
  let depthBraces = 0;
  let depthBrackets = 0;
  let inQuote: '"' | "'" | null = null;
  let escaped = false;

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) parts.push(trimmed);
    current = "";
  };

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (inQuote) {
      if (ch === "\\") {
        current += ch;
        escaped = true;
        continue;
      }
      if (ch === inQuote) {
        inQuote = null;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }
    if (ch === "{") {
      depthBraces++;
      current += ch;
      continue;
    }
    if (ch === "}") {
      depthBraces = Math.max(0, depthBraces - 1);
      current += ch;
      continue;
    }
    if (ch === "[") {
      depthBrackets++;
      current += ch;
      continue;
    }
    if (ch === "]") {
      depthBrackets = Math.max(0, depthBrackets - 1);
      current += ch;
      continue;
    }
    if (ch === "," && depthBraces === 0 && depthBrackets === 0) {
      pushCurrent();
      continue;
    }
    current += ch;
  }
  pushCurrent();

  const parseValue = (rawValue: string): unknown => {
    const value = rawValue.trim();
    if (!value) return "";
    if (value.startsWith("{") && value.endsWith("}")) {
      const parsed = parseInlineTable(value);
      if (parsed) {
        return parsed;
      }
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        return JSON.parse(value.replace(/'/g, '"'));
      } catch {
        return [];
      }
    }
    return value;
  };

  const result: Record<string, unknown> = {};

  for (const part of parts) {
    // Split on the first '=' not inside quotes/brackets/braces.
    let sep = -1;
    depthBraces = 0;
    depthBrackets = 0;
    inQuote = null;
    escaped = false;
    for (let i = 0; i < part.length; i++) {
      const ch = part[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (inQuote) {
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === inQuote) {
          inQuote = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === "{") {
        depthBraces++;
        continue;
      }
      if (ch === "}") {
        depthBraces = Math.max(0, depthBraces - 1);
        continue;
      }
      if (ch === "[") {
        depthBrackets++;
        continue;
      }
      if (ch === "]") {
        depthBrackets = Math.max(0, depthBrackets - 1);
        continue;
      }
      if (ch === "=" && depthBraces === 0 && depthBrackets === 0) {
        sep = i;
        break;
      }
    }

    if (sep <= 0) {
      continue;
    }

    let key = part.slice(0, sep).trim();
    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1);
    }

    const valueRaw = part.slice(sep + 1).trim();
    if (!key) continue;
    result[key] = parseValue(valueRaw);
  }

  return result;
};

const ensurePath = (root: Record<string, unknown>, pathSegments: string[]) => {
  let cursor: Record<string, unknown> = root;
  for (const segment of pathSegments) {
    if (!segment) continue;
    if (!cursor[segment] || typeof cursor[segment] !== "object") {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  return cursor;
};

const parseTomlValue = (raw: string): unknown => {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("{") && value.endsWith("}")) {
    const parsed = parseInlineTable(value);
    if (parsed) {
      return parsed;
    }
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value.replace(/'/g, '"'));
    } catch {
      return [];
    }
  }
  return value;
};

export const parseSimpleToml = (content: string): Record<string, unknown> => {
  const root: Record<string, unknown> = {};
  let currentPath: string[] = [];

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const section = trimmed.slice(1, -1).trim();
      currentPath = section
        .split(".")
        .map((part) => part.trim())
        .filter(Boolean);
      ensurePath(root, currentPath);
      continue;
    }

    const match = trimmed.match(/^(".*?"|[A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!match) continue;
    let key = match[1].trim();
    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1);
    }
    const value = parseTomlValue(match[2]);
    const target = ensurePath(root, currentPath);
    target[key] = value;
  }

  return root;
};

