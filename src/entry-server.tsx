// 빌드 시 각 경로의 첫 화면을 HTML 문자열로 그리는 진입점 (프리렌더 전용)
import { renderToString } from "react-dom/server";
import { placesPathOf, setServerUrl } from "./router";
import { App } from "./ui/App";
import * as PlacesUI from "./ui/places/PlacesApp";
import { registerPlacesUI } from "./places/lazy";
import { primePlaces } from "./places/store";
import { placesSeo } from "./places/seo";
import type { Place } from "./data/schema";

registerPlacesUI(PlacesUI);
primePlaces(import.meta.glob<Place[]>("./data/places/*.json", { eager: true, import: "default" }));

export function render(url: string): string {
  setServerUrl(url);
  return renderToString(<App />);
}

/** 아이랑 갈 곳 경로의 제목·설명 (prerender.mjs가 쓴다) */
export function placesMeta(path: string) {
  return placesSeo(placesPathOf(path));
}
