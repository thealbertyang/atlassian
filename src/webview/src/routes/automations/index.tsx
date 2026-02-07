import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/automations/")({
  component: RedirectComponent,
  staticData: { tabHidden: true },
});

function RedirectComponent() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/execute", replace: true });
  }, [navigate]);
  return null;
}
