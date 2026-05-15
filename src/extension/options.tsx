import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionOptions } from "./ExtensionOptions";
import "./extension.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ExtensionOptions />
  </StrictMode>,
);
