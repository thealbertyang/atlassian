import { createRootRoute, Outlet } from "@tanstack/react-router";
import App from "../App";

export const Route = createRootRoute({
  component: () => (
    <App>
      <Outlet />
    </App>
  ),
  notFoundComponent: () => (
    <div className="card">
      <h2>Route not found.</h2>
      <p className="note">The requested page could not be found.</p>
    </div>
  ),
});
