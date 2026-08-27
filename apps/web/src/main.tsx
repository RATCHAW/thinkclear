import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// DESIGN.md › Note on Font Substitutes — Manrope stands in for the licensed
// Forma DJR Micro, used directly with no metric adjustment.
import "@fontsource-variable/manrope";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
