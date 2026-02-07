import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/overview/")({
  component: RedirectComponent,
  staticData: { tabHidden: true },
});

function RedirectComponent() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/plan", replace: true });
  }, [navigate]);
  return null;
}
