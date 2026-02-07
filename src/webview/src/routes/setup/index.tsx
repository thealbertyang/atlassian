import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/setup/")({
  component: RedirectComponent,
  staticData: { tabHidden: true },
});

function RedirectComponent() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/system/settings", replace: true });
  }, [navigate]);
  return null;
}
