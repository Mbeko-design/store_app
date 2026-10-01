import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n/lang";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import "./styles.css";

// Register the service worker for offline use (production build only)
import { registerSW } from "virtual:pwa-register";

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <LangProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LangProvider>
    </ToastProvider>
  </StrictMode>,
);
