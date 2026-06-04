// Platform init — must run before any React renders
import "./lib/init";
import { initObservability } from "./lib/observability";

// Fire-and-forget; safe no-op if VITE_SENTRY_DSN / VITE_POSTHOG_KEY absent.
void initObservability();

import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { WebAuthProvider } from "./lib/auth";
import { queryClient } from "./lib/query";
import { BootGate } from "./components/BootGate";

import "./app/globals.css";
import "./app/(os)/os.css";
import "./app/(os)/dashboard.css";
import "./app/(os)/premium-ui.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BootGate>
      <QueryClientProvider client={queryClient}>
        <WebAuthProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </WebAuthProvider>
      </QueryClientProvider>
    </BootGate>
  </React.StrictMode>,
);
