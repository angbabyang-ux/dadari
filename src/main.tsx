// 앱 진입점. 저장된 화면 모드를 적용하고, 미리 그린 HTML이 있으면 이어받아(hydrate) 마운트한다
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./styles/index.css";
import { App } from "./ui/App";

try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch {
  /* 저장소를 못 쓰면 자동 모드 */
}

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
// 미리 그린 화면은 쿼리 없는 주소 기준이라, 쿼리가 있으면 새로 그린다.
// 하이드레이션은 첫 화면과 지역 랜딩에만 쓴다 (/changes·/data는 Lighthouse의 Edge에서만 불일치가 나서 새로 그림, context-notes 참고)
const path = window.location.pathname.replace(import.meta.env.BASE_URL, "/");
const hydratable = path === "/" || path.startsWith("/r/");
if (root.hasChildNodes() && !window.location.search && hydratable) hydrateRoot(root, app);
else {
  root.textContent = "";
  createRoot(root).render(app);
}

// 브라우저가 첫 화면을 실제로 그린 다음 웹폰트를 불러온다 (그 전에는 시스템 글꼴로 보여줌)
let fontsRequested = false;
const loadFonts = () => {
  if (fontsRequested) return;
  fontsRequested = true;
  void import("./styles/fonts.css");
};
try {
  const po = new PerformanceObserver((list) => {
    if (list.getEntries().some((e) => e.name === "first-contentful-paint")) {
      po.disconnect();
      setTimeout(loadFonts, 0);
    }
  });
  po.observe({ type: "paint", buffered: true });
} catch {
  /* 지원하지 않는 브라우저는 아래 시간 제한으로 */
}
setTimeout(loadFonts, 1500);
