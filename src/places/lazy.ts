// 아이랑 가볼만한 곳 화면 묶음을 따로 불러와 등록한다 (지원금 계산 첫 화면 묶음을 가볍게 유지)
import { useEffect, useSyncExternalStore } from "react";

type Mod = typeof import("../ui/places/PlacesApp");
let mod: Mod | null = null;
const listeners = new Set<() => void>();

/** 빌드 시 미리 그리기(SSR)에서는 바로 등록한다 */
export function registerPlacesUI(m: Mod) {
  mod = m;
}
export async function loadPlacesUI(): Promise<Mod> {
  if (mod) return mod;
  const m = await import("../ui/places/PlacesApp");
  mod = m;
  for (const l of listeners) l();
  return m;
}
export function usePlacesUI(active: boolean): Mod | null {
  const m = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => mod,
    () => mod,
  );
  useEffect(() => {
    if (active && !mod) void loadPlacesUI();
  }, [active]);
  return m;
}
