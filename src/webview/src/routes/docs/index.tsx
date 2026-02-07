import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/docs/")({
  component: RedirectComponent,
  staticData: { tabHidden: true },
});

function RedirectComponent() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/system/docs", replace: true });
  }, [navigate]);
  return null;
}
