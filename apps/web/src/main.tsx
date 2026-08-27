import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
// DESIGN.md › Note on Font Substitutes — Manrope stands in for the licensed
// Forma DJR Micro, used directly with no metric adjustment.
import "@fontsource-variable/manrope";
import "./index.css";
import App from "./App";
import { queryClient } from "./lib/query-client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
