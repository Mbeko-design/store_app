import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/cairo";
import "./styles/global.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

document.title = "CASHY";

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
