import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";

import "./app/globals.css";
import "./app/(marketing)/marketing.css";
import "./app/(os)/os.css";
import "./app/(os)/dashboard.css";
import "./app/(os)/premium-ui.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
