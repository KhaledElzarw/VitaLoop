import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionReminderWindow } from "./ExtensionReminderWindow";
import "./extension.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ExtensionReminderWindow />
  </StrictMode>,
);
