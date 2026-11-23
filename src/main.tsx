// 앱 진입점. 저장된 화면 모드를 적용하고 루트 컴포넌트를 DOM에 마운트한다
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { App } from "./ui/App";

try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch {
  /* 저장소를 못 쓰면 자동 모드 */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
