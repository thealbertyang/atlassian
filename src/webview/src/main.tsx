import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createRouter } from "./router";
import "./index.css";

const router = createRouter();

const mount = () => {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    return;
  }
  const root = createRoot(rootEl);
  root.render(<RouterProvider router={router} />);
};

if (import.meta.env.DEV) {
  void import("@tanstack/react-start").then(({ StartClient }) => {
    StartClient({ router });
  });
} else {
  mount();
}
