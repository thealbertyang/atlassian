import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/jira/issues/$key")({
  component: RedirectComponent,
  staticData: { tabHidden: true },
});

function RedirectComponent() {
  const navigate = useNavigate();
  const { key } = useParams({ from: "/jira/issues/$key" });
  useEffect(() => {
    navigate({ to: `/review/issues/${key}`, replace: true });
  }, [navigate, key]);
  return null;
}
