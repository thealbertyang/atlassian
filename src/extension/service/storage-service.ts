import { ConfigurationTarget, type ExtensionContext, type Uri, workspace } from "vscode";
import { posix as pathPosix } from "path";

export class StorageService {
  constructor(
    private readonly context: ExtensionContext,
    private readonly section?: string,
  ) {}

  getSetting<T>(key: string, fallback?: T, scope?: Uri): T | undefined {
    const config = workspace.getConfiguration(this.section, scope);
    return config.get<T>(key, fallback);
  }

  updateSetting<T>(
    key: string,
    value: T,
    target: ConfigurationTarget,
    scope?: Uri,
  ): Thenable<void> {
    const config = workspace.getConfiguration(this.section, scope);
    return config.update(key, value, target);
  }

  getGlobalState<T>(key: string, fallback?: T): T | undefined {
    return this.context.globalState.get<T>(key, fallback);
  }

  setGlobalState<T>(key: string, value: T): Thenable<void> {
    return this.context.globalState.update(key, value);
  }

  getWorkspaceState<T>(key: string, fallback?: T): T | undefined {
    return this.context.workspaceState.get<T>(key, fallback);
  }

  setWorkspaceState<T>(key: string, value: T): Thenable<void> {
    return this.context.workspaceState.update(key, value);
  }

  getSecret(key: string): Thenable<string | undefined> {
    return this.context.secrets.get(key);
  }

  storeSecret(key: string, value: string): Thenable<void> {
    return this.context.secrets.store(key, value);
  }

  deleteSecret(key: string): Thenable<void> {
    return this.context.secrets.delete(key);
  }

  get globalStorageUri(): Uri {
    return this.context.globalStorageUri;
  }

  get workspaceStorageUri(): Uri | undefined {
    return this.context.storageUri;
  }

  async readText(uri: Uri, fallback = ""): Promise<string> {
    try {
      const bytes = await workspace.fs.readFile(uri);
      return new TextDecoder().decode(bytes);
    } catch {
      return fallback;
    }
  }

  async writeText(uri: Uri, value: string): Promise<void> {
    await this.ensureParentDir(uri);
    const bytes = new TextEncoder().encode(value);
    await workspace.fs.writeFile(uri, bytes);
  }

  async readJson<T>(uri: Uri, fallback: T): Promise<T> {
    const text = await this.readText(uri, "");
    if (!text) {
      return fallback;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return fallback;
    }
  }

  async writeJson(uri: Uri, value: unknown): Promise<void> {
    const text = JSON.stringify(value, null, 2);
    await this.writeText(uri, text);
  }

  private async ensureParentDir(uri: Uri): Promise<void> {
    const parent = uri.with({ path: pathPosix.dirname(uri.path) });
    await workspace.fs.createDirectory(parent);
  }
}
