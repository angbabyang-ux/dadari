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

export function useLocation(): { route: Route; params: URLSearchParams } {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const url = new URL(snap, window.location.origin);
  return { route: routeOf(url.pathname), params: url.searchParams };
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
