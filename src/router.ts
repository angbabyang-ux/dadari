// History API 기반의 작은 라우터. 경로와 쿼리스트링을 React 상태로 연결한다
import { useSyncExternalStore } from "react";

export type Route = "home" | "result" | "compare" | "changes" | "data";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, ""); // "/dadari"
const PATHS: Record<Route, string> = { home: "/", result: "/result/", compare: "/compare/", changes: "/changes/", data: "/data/" };

function routeOf(pathname: string): Route {
  const p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const seg = p.replace(/^\/+|\/+$/g, "").split("/")[0];
  if (seg === "result" || seg === "compare" || seg === "changes" || seg === "data") return seg;
  return "home";
}

export function hrefFor(route: Route, query?: string): string {
  return `${BASE}${PATHS[route]}${query ? `?${query}` : ""}`;
}

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
if (typeof window !== "undefined") window.addEventListener("popstate", emit);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getSnapshot = () => window.location.pathname + window.location.search;

// 빌드 시 정적 HTML을 그릴 때 쓰는 주소 (브라우저에서는 쓰지 않음)
let serverUrl = "/";
export function setServerUrl(url: string) {
  serverUrl = url;
}
const getServerSnapshot = () => serverUrl;

/** 지역 랜딩 경로(/r/<지역id>/)면 지역 id를 돌려준다 */
function regionOf(pathname: string): string | undefined {
  const p = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const m = p.match(/^\/r\/([a-z0-9-]+)\/?$/);
  return m?.[1];
}

export function useLocation(): { route: Route; params: URLSearchParams; regionId?: string } {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const url = new URL(snap, "http://localhost");
  return { route: routeOf(url.pathname), params: url.searchParams, regionId: regionOf(url.pathname) };
}

export function navigate(route: Route, query?: string) {
  window.history.pushState(null, "", hrefFor(route, query));
  window.scrollTo(0, 0);
  emit();
}

/** 같은 화면에서 쿼리만 바꾼다 (기록을 쌓지 않음) */
export function replaceQuery(query: string) {
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", url);
  emit();
}
