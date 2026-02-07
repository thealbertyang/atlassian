import fs from "fs";
import path from "path";
import { workspace } from "vscode";
import { parseSimpleToml } from "../../shared/simple-toml";
import type {
  UniversalAction,
  UniversalCommand,
  UniversalConfig,
  UniversalDataset,
  UniversalEnvironment,
  UniversalEvent,
  UniversalNamespace,
  UniversalObjectClass,
  UniversalPlatform,
  UniversalRoute,
  UniversalRule,
  UniversalRuleSet,
  UniversalView,
} from "../../shared/universal";
import { createUniversalRegistry } from "../../shared/universal";

const UNIVERSAL_CONFIG_REL_PATH = path.join("config", "universal.toml");

const isFile = (value: string): boolean => {
  try {
    return fs.statSync(value).isFile();
  } catch {
    return false;
  }
};

const normalizeMap = <T extends { id?: string }>(
  value?: Record<string, T>,
): Record<string, T> | undefined => {
  if (!value) {
    return undefined;
  }
  const result: Record<string, T> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (!entry) return;
    const id = entry.id ?? key;
    result[id] = { ...entry, id };
  });
  return result;
};

const normalizeNamespaces = (
  value?: Record<string, UniversalNamespace | string>,
): Record<string, UniversalNamespace> | undefined => {
  if (!value) {
    return undefined;
  }
  const result: Record<string, UniversalNamespace> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (!entry) return;
    if (typeof entry === "string") {
      result[key] = { id: key, prefix: entry };
      return;
    }
    result[key] = {
      id: entry.id ?? key,
      prefix: entry.prefix ?? key,
      description: entry.description,
    };
  });
  return result;
};

const normalizeUniversalConfig = (
  raw: Partial<UniversalConfig>,
): Partial<UniversalConfig> => {
  return {
    ...raw,
    namespaces: normalizeNamespaces(raw.namespaces as Record<string, UniversalNamespace | string>),
    actions: normalizeMap(raw.actions as Record<string, UniversalAction>),
    commands: normalizeMap(raw.commands as Record<string, UniversalCommand>),
    events: normalizeMap(raw.events as Record<string, UniversalEvent>),
    routes: normalizeMap(raw.routes as Record<string, UniversalRoute>),
    views: normalizeMap(raw.views as Record<string, UniversalView>),
    objects: normalizeMap(raw.objects as Record<string, UniversalObjectClass>),
    datasets: normalizeMap(raw.datasets as Record<string, UniversalDataset>),
    rules: normalizeMap(raw.rules as Record<string, UniversalRule>),
    rulesets: normalizeMap(raw.rulesets as Record<string, UniversalRuleSet>),
    platforms: normalizeMap(raw.platforms as Record<string, UniversalPlatform>),
    environments: normalizeMap(raw.environments as Record<string, UniversalEnvironment>),
  };
};

const resolveUniversalConfigPath = (extensionPath: string): string | undefined => {
  const workspaceFolders = workspace.workspaceFolders ?? [];
  for (const folder of workspaceFolders) {
    const candidate = path.join(folder.uri.fsPath, UNIVERSAL_CONFIG_REL_PATH);
    if (isFile(candidate)) {
      return candidate;
    }
  }

  const fallback = path.join(extensionPath, UNIVERSAL_CONFIG_REL_PATH);
  if (isFile(fallback)) {
    return fallback;
  }

  return undefined;
};

export class UniversalConfigService {
  private cached?: UniversalConfig;
  private cachedMtimeMs?: number;
  private configPath?: string;

  constructor(private readonly extensionPath: string) {}

  getConfig(): UniversalConfig {
    const configPath = resolveUniversalConfigPath(this.extensionPath);
    if (!configPath) {
      this.cached = createUniversalRegistry(undefined).config;
      this.cachedMtimeMs = undefined;
      this.configPath = undefined;
      return this.cached;
    }

    try {
      const stat = fs.statSync(configPath);
      const mtimeMs = stat.mtimeMs;
      if (this.cached && this.configPath === configPath && this.cachedMtimeMs === mtimeMs) {
        return this.cached;
      }

      this.configPath = configPath;
      const content = fs.readFileSync(configPath, "utf8");
      const parsed = parseSimpleToml(content) as Partial<UniversalConfig>;
      const override = normalizeUniversalConfig(parsed);
      this.cached = createUniversalRegistry(override).config;
      this.cachedMtimeMs = mtimeMs;
      return this.cached;
    } catch {
      this.cached = createUniversalRegistry(undefined).config;
      this.cachedMtimeMs = undefined;
      return this.cached;
    }
  }

  getConfigPath(): string | undefined {
    if (this.configPath) {
      return this.configPath;
    }
    this.configPath = resolveUniversalConfigPath(this.extensionPath);
    return this.configPath;
  }
}
