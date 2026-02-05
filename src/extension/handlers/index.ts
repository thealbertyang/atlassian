import { createAuthHandlers } from "./auth";
import { createAutomationHandlers } from "./automations";
import { createDocsHandlers } from "./docs";
import { createDevHandlers } from "./dev";
import { createHttpHandlers } from "./http";
import { createIssueHandlers } from "./issues";
import { createMessageHandlers } from "./messages";
import { createSettingsHandlers } from "./settings";
import { createThemeHandlers } from "./theme";
import type { HandlerDependencies } from "./types";

export type { HandlerDependencies } from "./types";

export const getHandlers = (dependencies: HandlerDependencies) => ({
  ...createThemeHandlers(dependencies),
  ...createMessageHandlers(),
  ...createHttpHandlers(),
  ...createAuthHandlers(dependencies),
  ...createIssueHandlers(dependencies),
  ...createSettingsHandlers(dependencies),
  ...createDocsHandlers(dependencies),
  ...createDevHandlers(dependencies),
  ...createAutomationHandlers(dependencies),
});

export type HandlersType = ReturnType<typeof getHandlers>;
