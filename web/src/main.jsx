import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import "./utils/i18n";
import "./index.css";

const isElectron =
  typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent || "");

const Router = isElectron ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>
);
