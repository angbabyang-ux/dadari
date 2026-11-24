// 앱 진입점. 저장된 화면 모드를 적용하고, 미리 그린 HTML이 있으면 이어받아(hydrate) 마운트한다
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./styles/index.css";
import { App } from "./ui/App";
import { loadPlacesUI } from "./places/lazy";
import { loadRegions } from "./places/store";

try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch {
  /* 저장소를 못 쓰면 자동 모드 */
}

/** 첫 화면이 실제로 그려진 다음 (지원하지 않거나 늦으면 1초 뒤) */
function afterFirstPaint(): Promise<void> {
  return new Promise((done) => {
    const t = setTimeout(done, 1000);
    try {
      const po = new PerformanceObserver((list) => {
        if (list.getEntries().some((e) => e.name === "first-contentful-paint")) {
          po.disconnect();
          clearTimeout(t);
          done();
        }
      });
      po.observe({ type: "paint", buffered: true });
    } catch {
      /* 시간 제한으로 */
    }
  });
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
const hydratable = path === "/" || path === "/calc/" || path.startsWith("/r/");
if (root.hasChildNodes() && !window.location.search && hydratable) hydrateRoot(root, app);
else if (path.startsWith("/places")) {
  // 아이랑 가볼만한 곳: 미리 그린 HTML이 먼저 화면에 그려진 뒤, 화면 묶음과 지역 데이터를 받아 이어받는다
  // (실내 모음은 지역 파일이 25개라, 첫 그리기 전에 요청하면 첫 화면이 늦어진다)
  void afterFirstPaint()
    .then(loadPlacesUI)
    .then((m) => loadRegions(m.regionsNeeded(window.location.pathname, new URLSearchParams(window.location.search))))
    .finally(() => {
      // 데이터가 미리 그린 HTML과 같으니 이어받는다. 쿼리(필터)가 있으면 내용이 달라서 새로 그린다
      if (root.hasChildNodes() && !window.location.search) hydrateRoot(root, app);
      else {
        root.textContent = "";
        createRoot(root).render(app);
      }
    });
} else {
  root.textContent = "";
  createRoot(root).render(app);
}
