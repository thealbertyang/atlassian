import { workspace } from "vscode";
import { asBehaviorSubject } from "@jsonrpc-rx/server";
import { toPromise } from "../util/to-promise";
import type { HandlerDependencies } from "./types";

type ThemeDependencies = Pick<HandlerDependencies, "context">;

export const createThemeHandlers = ({ context }: ThemeDependencies) => ({
  getTheme: () => workspace.getConfiguration().get("workbench.colorTheme") as string,

  setTheme: (theme: string) => {
    const then = workspace.getConfiguration().update("workbench.colorTheme", theme);
    return toPromise(then);
  },

  onThemeChange: asBehaviorSubject(({ next }) => {
    const disposable = workspace.onDidChangeConfiguration(() => {
      const colorTheme = workspace.getConfiguration().get("workbench.colorTheme");
      next(colorTheme);
    });
    context.subscriptions.push(disposable);
    return disposable.dispose.bind(disposable);
  }, workspace.getConfiguration().get("workbench.colorTheme")),
});
