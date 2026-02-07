import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROUTE_META } from "@shared/contracts";

export const Route = createFileRoute("/system/setup")({
  staticData: ROUTE_META.systemSetup,
  beforeLoad: () => {
    throw redirect({ to: "/system/settings" });
  },
  component: () => null,
});
