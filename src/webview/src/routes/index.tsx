import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
  staticData: {
    tabHidden: true,
  },
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/overview", replace: true });
  }, [navigate]);

  return (
    <div className="card">
      <h2>Loading…</h2>
      <p className="note">Routing to Overview.</p>
    </div>
  );
}
