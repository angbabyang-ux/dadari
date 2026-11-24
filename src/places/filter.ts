// 아이랑 가볼만한 곳 필터·정렬과 URL 쿼리 변환 (순수 함수, 화면과 테스트가 같이 쓴다)
import type { AgeBand, Place } from "../data/schema";

export type PlaceFilter = {
  indoor: boolean; // 실내만 (실내·실내외)
  free: boolean; // 무료로 확인된 곳만
  age: AgeBand | null; // 우리 아이 나이: 이용 연령이 확인된 곳 중 맞는 곳만
  nursing: boolean; // 수유실 있음으로 확인된 곳만
  stroller: boolean; // 유모차 진입 가능으로 확인된 곳만
  noReservation: boolean; // 예약 없이 갈 수 있다고 확인된 곳만
};

export const EMPTY_FILTER: PlaceFilter = { indoor: false, free: false, age: null, nursing: false, stroller: false, noReservation: false };

export const AGE_LABEL: Record<AgeBand, string> = { "0": "0~12개월", "1-3": "1~3세", "4-7": "4~7세" };
export const AGE_BANDS: AgeBand[] = ["0", "1-3", "4-7"];

export function isEmptyFilter(f: PlaceFilter): boolean {
  return !f.indoor && !f.free && !f.age && !f.nursing && !f.stroller && !f.noReservation;
}

/** 확인되지 않은 값(null)은 조건을 만족한다고 보지 않는다 */
export function matches(p: Place, f: PlaceFilter): boolean {
  if (f.indoor && p.setting === "outdoor") return false;
  if (f.free && p.fee.free !== true) return false;
  if (f.age && !(p.ages ?? []).includes(f.age)) return false;
  if (f.nursing && p.amenities.nursingRoom !== true) return false;
  if (f.stroller && p.amenities.strollerAccess !== true) return false;
  if (f.noReservation && p.reservation?.need !== "no") return false;
  return true;
}

export function filterPlaces(list: Place[], f: PlaceFilter): Place[] {
  return list.filter((p) => matches(p, f));
}

const CAT_ORDER: Record<Place["category"], number> = { kidscafe: 0, library: 1, museum: 2, park: 3 };
/** 실내 페이지 정렬: 무료로 확인된 공공시설 먼저, 그다음 종류(키즈카페·도서관·박물관)·지역·이름 순 */
export function sortIndoor(list: Place[]): Place[] {
  return [...list].sort(
    (a, b) =>
      Number(b.fee.free === true) - Number(a.fee.free === true) ||
      CAT_ORDER[a.category] - CAT_ORDER[b.category] ||
      a.sigungu.localeCompare(b.sigungu) ||
      a.name.localeCompare(b.name, "ko"),
  );
}

export function filterFromParams(p: URLSearchParams): PlaceFilter {
  const age = p.get("age");
  return {
    indoor: p.get("in") === "1",
    free: p.get("free") === "1",
    age: age === "0" || age === "1-3" || age === "4-7" ? age : null,
    nursing: p.get("nr") === "1",
    stroller: p.get("st") === "1",
    noReservation: p.get("rv") === "0",
  };
}

/** 기존 쿼리의 다른 값(view, sd, sg 등)은 남기고 필터 값만 바꾼다 */
export function filterToParams(f: PlaceFilter, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  for (const k of ["in", "free", "age", "nr", "st", "rv"]) p.delete(k);
  if (f.indoor) p.set("in", "1");
  if (f.free) p.set("free", "1");
  if (f.age) p.set("age", f.age);
  if (f.nursing) p.set("nr", "1");
  if (f.stroller) p.set("st", "1");
  if (f.noReservation) p.set("rv", "0");
  return p;
}
