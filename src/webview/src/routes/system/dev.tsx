import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROUTE_META } from "@shared/contracts";

export const Route = createFileRoute("/system/dev")({
  staticData: ROUTE_META.systemDev,
  beforeLoad: () => {
    throw redirect({ to: "/system/settings" });
  },
  component: () => null,
});
