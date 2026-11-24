// 지역별 장소 JSON을 필요할 때만 불러와 보관한다 (첫 화면 묶음에 장소 데이터를 넣지 않기 위해)
import { useSyncExternalStore } from "react";
import type { Place } from "../data/schema";
import { regions } from "../data";

const loaders = import.meta.glob<Place[]>("../data/places/*.json", { import: "default" });
const cache = new Map<string, Place[]>();
let version = 0;
const listeners = new Set<() => void>();

export const SIDO_IDS = ["seoul", "gyeonggi"] as const;
export type SidoId = (typeof SIDO_IDS)[number];
export const SIDO_NAME: Record<SidoId, string> = { seoul: "서울특별시", gyeonggi: "경기도" };
export const SIDO_SHORT: Record<SidoId, string> = { seoul: "서울", gyeonggi: "경기" };

export const placeRegions = regions.sigungu.filter((r) => r.sido === "서울특별시" || r.sido === "경기도");
export const slugOf = (id: string) => id.replace(/^(seoul|gyeonggi)-/, "");
export const sidoOfRegion = (id: string): SidoId => (id.startsWith("seoul-") ? "seoul" : "gyeonggi");
export function regionsOfSido(sido: SidoId) {
  return placeRegions.filter((r) => r.sido === SIDO_NAME[sido]).sort((a, b) => a.sigungu.localeCompare(b.sigungu, "ko"));
}
export function regionBySlug(sido: string, slug: string) {
  return placeRegions.find((r) => r.id === `${sido}-${slug}`);
}

/** 빌드 시 미리 그리기(SSR)에서 모든 지역을 한 번에 채운다 */
export function primePlaces(all: Record<string, Place[]>) {
  for (const [k, v] of Object.entries(all)) cache.set(k.replace(/^.*\/(.+)\.json$/, "$1"), v);
}
export function placesOf(id: string): Place[] | undefined {
  return cache.get(id);
}
export async function loadRegions(ids: string[]): Promise<void> {
  const need = ids.filter((id) => !cache.has(id) && loaders[`../data/places/${id}.json`]);
  if (need.length === 0) return;
  const lists = await Promise.all(need.map((id) => loaders[`../data/places/${id}.json`]!()));
  need.forEach((id, i) => cache.set(id, lists[i]!));
  version++;
  for (const l of listeners) l();
}
export function useStoreVersion(): number {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => version,
    () => version,
  );
}
