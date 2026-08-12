import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameApp } from "./app/GameApp";
import "./styles/globals.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("TCGTycoon requires a #root element");
}

createRoot(root).render(
  <StrictMode>
    <GameApp />
  </StrictMode>,
);
