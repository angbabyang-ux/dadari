// 입력값이 URL 쿼리로 저장됐다가 그대로 복원되는지 검사하는 테스트
import { describe, expect, it } from "vitest";
import { draftFromParams, draftToParams, isComplete, type Draft } from "../../src/state/url";

describe("URL 상태", () => {
  it("입력값을 쿼리로 바꿨다가 그대로 되살린다", () => {
    const d: Draft = {
      birthDate: "2027-03-02",
      expected: true,
      birthOrder: 2,
      multiples: 2,
      care: { daycareFrom: 14, kindergartenFrom: 38, kindergartenKind: "private" },
      sido: "경기도",
      sigungu: "가평군",
      moveInDate: "2026-05-01",
      householdSize: 4,
      monthlyIncome: 6000000,
      homeless: true,
      jeonse: 300000000,
      monthlyRent: 500000,
      singleParent: false,
      mother: { employment: "insured", wage: 3200000, leave: { startMonth: 0, months: 12 } },
      father: { employment: "uninsured-self", wage: 0 },
    };
    const back = draftFromParams(new URLSearchParams(draftToParams(d)));
    expect(back).toEqual({ ...d, tierOverride: undefined, father: { ...d.father, leave: undefined } });
    expect(isComplete(back)).toBe(true);
  });

  it("빈 쿼리는 미완성 초안이 된다", () => {
    const d = draftFromParams(new URLSearchParams(""));
    expect(isComplete(d)).toBe(false);
    expect(d.birthOrder).toBe(1);
  });

  it("다른 시도의 시군구 id는 무시한다", () => {
    const d = draftFromParams(new URLSearchParams("b=2026-12-01&sd=seoul&sg=gyeonggi-suwon"));
    expect(d.sido).toBe("서울특별시");
    expect(d.sigungu).toBeUndefined();
  });
});
