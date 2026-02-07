import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROUTE_META } from "@shared/contracts";

export const Route = createFileRoute("/execute/automations")({
  staticData: ROUTE_META.executeAutomations,
  beforeLoad: () => {
    throw redirect({ to: "/execute", replace: true });
  },
  component: () => null,
});
