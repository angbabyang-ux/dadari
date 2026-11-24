// 아이랑 갈 곳 필터·정렬·URL 변환 로직 테스트
import { describe, expect, it } from "vitest";
import type { Place } from "../../src/data/schema";
import { EMPTY_FILTER, filterFromParams, filterPlaces, filterToParams, isEmptyFilter, sortIndoor } from "../../src/places/filter";
import { placesPathOf, placesHref } from "../../src/router";
import { ageBands } from "../../scripts/fetch-places.mjs";

function mk(over: Partial<Place> & { id: string }): Place {
  return {
    name: over.id,
    sido: "seoul",
    sigungu: "seoul-gangseo",
    address: "서울특별시 강서구 어딘가 1",
    lat: 37.55,
    lng: 126.85,
    setting: "indoor",
    ages: null,
    agesText: null,
    fee: { free: null, text: null },
    category: "library",
    hours: null,
    closedDays: null,
    reservation: null,
    amenities: { nursingRoom: null, diaperTable: null, strollerAccess: null, parking: null },
    homepage: null,
    summary: "테스트 장소예요.",
    source: "library",
    sourceUrl: "https://www.data.go.kr/data/15013109/standard.do",
    lastVerified: "2026-09-01",
    ...over,
  };
}

const A = mk({ id: "lb-a", fee: { free: true, text: "무료" }, reservation: { need: "no", note: "" } });
const B = mk({ id: "kc-b", category: "kidscafe", ages: ["1-3", "4-7"], fee: { free: false, text: "유료" }, reservation: { need: "yes", note: "" } });
const C = mk({ id: "pk-c", category: "park", setting: "outdoor", reservation: { need: "no", note: "" } });
const D = mk({ id: "ms-d", category: "museum", amenities: { nursingRoom: true, diaperTable: null, strollerAccess: true, parking: true }, fee: { free: true, text: "무료" } });
const E = mk({ id: "kc-e", category: "kidscafe", setting: "mixed", ages: ["0"], fee: { free: true, text: "무료" } });
const ALL = [A, B, C, D, E];
const ids = (l: Place[]) => l.map((p) => p.id);

describe("필터", () => {
  it("전체(빈 필터)는 모두 보여 준다", () => {
    expect(ids(filterPlaces(ALL, EMPTY_FILTER))).toEqual(ids(ALL));
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
  });
  it("실내만: 야외를 빼고 실내외는 남긴다", () => {
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, indoor: true }))).toEqual(["lb-a", "kc-b", "ms-d", "kc-e"]);
  });
  it("무료만: 무료로 확인된 곳만 (요금 확인 필요는 뺀다)", () => {
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, free: true }))).toEqual(["lb-a", "ms-d", "kc-e"]);
  });
  it("우리 아이 나이: 이용 연령이 확인된 곳 중 겹치는 곳만", () => {
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, age: "1-3" }))).toEqual(["kc-b"]);
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, age: "0" }))).toEqual(["kc-e"]);
  });
  it("수유실·유모차: 있다고 확인된 곳만", () => {
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, nursing: true }))).toEqual(["ms-d"]);
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, stroller: true }))).toEqual(["ms-d"]);
  });
  it("예약 필요 없음: 예약 없이 간다고 확인된 곳만", () => {
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, noReservation: true }))).toEqual(["lb-a", "pk-c"]);
  });
  it("여러 조건은 모두 만족해야 한다", () => {
    expect(ids(filterPlaces(ALL, { ...EMPTY_FILTER, indoor: true, free: true, noReservation: true }))).toEqual(["lb-a"]);
  });
});

describe("실내 정렬", () => {
  it("무료로 확인된 곳 먼저, 그다음 키즈카페·도서관·박물관 순", () => {
    expect(ids(sortIndoor([B, D, A, E]))).toEqual(["kc-e", "lb-a", "ms-d", "kc-b"]);
  });
});

describe("URL 쿼리", () => {
  it("필터를 쿼리로 바꿨다가 되돌리면 같다", () => {
    const f = { indoor: true, free: true, age: "4-7" as const, nursing: true, stroller: false, noReservation: true };
    const p = filterToParams(f, new URLSearchParams("view=map"));
    expect(p.get("view")).toBe("map");
    expect(filterFromParams(p)).toEqual(f);
    expect(filterToParams(EMPTY_FILTER, p).toString()).toBe("view=map");
  });
  it("모르는 나이 값은 무시한다", () => {
    expect(filterFromParams(new URLSearchParams("age=9")).age).toBeNull();
  });
});

describe("경로", () => {
  it("아이랑 갈 곳 하위 경로를 읽는다", () => {
    expect(placesPathOf("/dadari/places/")).toEqual({ kind: "home" });
    expect(placesPathOf("/dadari/places/indoor/")).toEqual({ kind: "indoor" });
    expect(placesPathOf("/dadari/places/seoul/")).toEqual({ kind: "sido", sido: "seoul" });
    expect(placesPathOf("/dadari/places/seoul/gangseo/")).toEqual({ kind: "region", sido: "seoul", slug: "gangseo" });
    expect(placesHref("gyeonggi/suwon")).toBe(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/places/gyeonggi/suwon/`);
    expect(placesHref("indoor", "sd=gyeonggi")).toMatch(/\/places\/indoor\/\?sd=gyeonggi$/);
  });
});

describe("이용 연령 문구 → 연령대", () => {
  it("겹치는 연령대를 고른다", () => {
    expect(ageBands("0세 ~ 6세")).toEqual(["0", "1-3", "4-7"]);
    expect(ageBands("4세 ~ 9세")).toEqual(["4-7"]);
    expect(ageBands("3세 ~ 6세")).toEqual(["1-3", "4-7"]);
    expect(ageBands("8세 ~ 12세")).toBeNull();
    expect(ageBands("")).toBeNull();
  });
});
