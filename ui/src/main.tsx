import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./theme/theme.css";
import { getSavedTheme, applyTheme } from "./theme/tokens";

// Initialize saved theme on DOM root
applyTheme(getSavedTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

