import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App.js";
import { installRendererDiagnostics } from "./diagnostics/renderer-diagnostics.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Renderer root is missing");

installRendererDiagnostics();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
