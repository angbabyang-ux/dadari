// 빌드 시 각 경로의 첫 화면을 HTML 문자열로 그리는 진입점 (프리렌더 전용)
import { renderToString } from "react-dom/server";
import { setServerUrl } from "./router";
import { App } from "./ui/App";

export function render(url: string): string {
  setServerUrl(url);
  return renderToString(<App />);
}
