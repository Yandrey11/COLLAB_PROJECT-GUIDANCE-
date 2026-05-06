import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initializeTheme, initializeColorTheme } from "./utils/themeUtils";

// Initialize theme + color theme before app renders
initializeTheme();
initializeColorTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
