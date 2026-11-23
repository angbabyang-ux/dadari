// 앱 진입점. 루트 컴포넌트를 DOM에 마운트한다
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";

function App() {
  return <main className="p-4">다달이 준비 중이에요.</main>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
