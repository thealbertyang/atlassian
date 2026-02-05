import { createRouter as createRouterCore } from "@tanstack/react-router";
import { createHashHistory, createMemoryHistory } from "@tanstack/history";
import { routeTree } from "./routeTree.gen";

const isBrowser = typeof window !== "undefined";

const createHistory = () =>
  isBrowser ? createHashHistory() : createMemoryHistory({ initialEntries: ["/"] });

export const createAppRouter = () =>
  createRouterCore({
    routeTree,
    history: createHistory(),
    defaultPreload: "intent",
  });

export type AppRouter = ReturnType<typeof createAppRouter>;

export const createRouterInstance = (): AppRouter => createAppRouter();

export const createRouter = createRouterInstance;

export const getRouter = async (): Promise<AppRouter> => createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
