import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { runtimeReleaseContext } from "./release-context";
import "./styles.css";
import "./supplemental.css";
import "./modern.css";
import "./card-preview.css";
import "./future.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App releaseContext={runtimeReleaseContext} /></StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
