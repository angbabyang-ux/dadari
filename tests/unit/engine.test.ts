// 지시서 9장 테스트 케이스(T1~T15)와 금액 표기를 검증하는 엔진 단위 테스트
import { describe, expect, it } from "vitest";
import { benefits, leaveRules, reference, regions } from "../../src/data";
import { computeLeave } from "../../src/engine/leave";
import { formatWon } from "../../src/engine/money";
import { computeTimeline, timelineLength } from "../../src/engine/timeline";
import type { Input, ParentInput, Result } from "../../src/engine/types";

const data = { benefits, regions, leaveRules, reference };
const none: ParentInput = { employment: "none", wage: 0 };

function input(over: Partial<Input> = {}): Input {
  return {
    birthDate: "2026-12-15",
    expected: false,
    birthOrder: 1,
    multiples: 1,
    care: {},
    sido: "서울특별시",
    sigungu: "강남구",
    householdSize: 3,
    homeless: false,
    singleParent: false,
    mother: none,
    father: none,
    ...over,
  };
}

const leaveSum = (i: Input, who: "mother" | "father") =>
  computeLeave(i, leaveRules).months.filter((m) => m.parent === who).reduce((a, m) => a + m.amount, 0);
const at = (r: Result, age: number, id: string) => r.rows[age]!.items.filter((x) => x.benefitId === id);
const sumOf = (r: Result, id: string) => r.rows.flatMap((x) => x.items).filter((x) => x.benefitId === id).reduce((a, c) => a + c.amount, 0);
const total = (r: Result) => r.rows.reduce((a, x) => a + x.total, 0);

describe("금액 표기", () => {
  it.each([
    [1850000, "185만 원"],
    [105000, "10만 5천 원"],
    [23100000, "2,310만 원"],
    [1684210, "168만 4,210원"],
    [584000, "58만 4천 원"],
    [5000, "5천 원"],
    [0, "0원"],
  ])("%i → %s", (won, text) => expect(formatWon(won)).toBe(text));
});

describe("타임라인 범위", () => {
  it("출생월부터 출생연도+7년 2월까지", () => {
    expect(timelineLength("2026-12-15")).toBe(75);
    const r = computeTimeline(input(), data, { scenario: "current" });
    expect(r.rows[0]!.month).toBe("2026-12");
    expect(r.rows.at(-1)!.month).toBe("2033-02");
    expect(computeTimeline(input({ birthDate: "2027-01-05" }), data, { scenario: "current" }).rows.at(-1)!.month).toBe("2034-02");
  });
});

describe("육아휴직 급여", () => {
  const ins = (wage: number, startMonth: number, months: number): ParentInput => ({ employment: "insured", wage, leave: { startMonth, months } });

  it("T1 통상임금 300만, 12개월 → 2,310만 원", () => {
    expect(leaveSum(input({ mother: ins(3000000, 0, 12) }), "mother")).toBe(23100000);
  });
  it("T2 통상임금 150만, 3개월 → 450만 원", () => {
    expect(leaveSum(input({ mother: ins(1500000, 0, 3) }), "mother")).toBe(4500000);
  });
  it("T3 통상임금 60만 → 매월 하한 70만 원", () => {
    const m = computeLeave(input({ mother: ins(600000, 0, 4) }), leaveRules).months;
    expect(m.every((x) => x.amount === 700000)).toBe(true);
  });
  it.each([
    [5000000, 20000000],
    [3000000, 17000000],
    [4000000, 19500000],
  ])("T4~T6 6+6 통상임금 %i, 6개월 → %i", (wage, expected) => {
    const i = input({ mother: ins(wage, 0, 6), father: ins(wage, 6, 6) });
    expect(computeLeave(i, leaveRules).sixPlusSix).toBe(true);
    expect(leaveSum(i, "mother")).toBe(expected);
    expect(leaveSum(i, "father")).toBe(expected);
  });
  it("T7 아빠가 생후 19개월에 시작하면 6+6 미적용", () => {
    const i = input({ mother: ins(5000000, 0, 6), father: ins(5000000, 19, 6) });
    const r = computeLeave(i, leaveRules);
    expect(r.sixPlusSix).toBe(false);
    expect(leaveSum(i, "father")).toBe(2500000 * 3 + 2000000 * 3);
  });
  it("T8 부모 각각 3개월 이상 → 각자 18개월, 13~18개월 상한 160만 원", () => {
    const i = input({ mother: ins(3000000, 0, 18), father: ins(3000000, 20, 3) });
    const r = computeLeave(i, leaveRules);
    const mom = r.months.filter((m) => m.parent === "mother");
    expect(mom).toHaveLength(18);
    expect(mom.slice(12).every((m) => m.amount === 1600000)).toBe(true);
    const solo = computeLeave(input({ mother: ins(3000000, 0, 18) }), leaveRules);
    expect(solo.months).toHaveLength(12);
  });
});

describe("지역·출생일별 타임라인", () => {
  it("T9 2026-12-15 첫째, 강남구, 가정양육", () => {
    const r = computeTimeline(input(), data, { scenario: "current" });
    expect(at(r, 1, "first-meeting-voucher")[0]!.amount).toBe(2000000);
    expect(at(r, 1, "seoul-postpartum-care")[0]!.amount).toBe(1000000);
    expect(at(r, 1, "seoul-gangnam-birth-grant")[0]!.amount).toBe(2000000);
    for (const age of [0, 5, 11]) {
      expect(at(r, age, "parent-pay")[0]!.amount).toBe(1000000);
      expect(at(r, age, "child-allowance")[0]!.amount).toBe(100000);
    }
    for (const age of [12, 23]) {
      expect(at(r, age, "parent-pay")[0]!.amount).toBe(500000);
      expect(at(r, age, "child-allowance")[0]!.amount).toBe(100000);
    }
    expect(at(r, 24, "parent-pay")).toHaveLength(0);
  });

  it("T10 같은 조건 강서구 → 강남구 출산양육지원금 200만 원만큼 적다", () => {
    const gangnam = computeTimeline(input(), data, { scenario: "current" });
    const gangseo = computeTimeline(input({ sigungu: "강서구" }), data, { scenario: "current" });
    expect(total(gangnam) - total(gangseo)).toBe(2000000);
  });

  it("T11 2027-07-10 출생, 정부안 포함", () => {
    const i = input({ birthDate: "2027-07-10", sigungu: "강서구" });
    const on = computeTimeline(i, data, { scenario: "with-proposals" });
    expect([1, 4, 7, 10].map((a) => at(on, a, "ai-welcome-grant")[0]?.amount)).toEqual([2500000, 2500000, 2500000, 2500000]);
    expect(sumOf(on, "ai-welcome-grant")).toBe(10000000);
    for (const age of [0, 23]) {
      expect(at(on, age, "child-basic-allowance-cash")[0]!.amount + at(on, age, "child-basic-allowance-local")[0]!.amount).toBe(200000);
      expect(at(on, age, "child-basic-allowance-home-bonus")[0]!.amount).toBe(300000);
    }
    expect(at(on, 24, "child-basic-allowance-home-bonus")).toHaveLength(0);
    expect(sumOf(on, "parent-pay")).toBe(0);

    const off = computeTimeline(i, data, { scenario: "current" });
    expect(sumOf(off, "ai-welcome-grant")).toBe(0);
    expect(sumOf(off, "child-basic-allowance-cash")).toBe(0);
    expect(off.pendingReform).toBe(true);
  });

  it("T12 2027-01-25 출생 → 아동수당·부모급여·첫만남은 신청 없이 지급", () => {
    const r = computeTimeline(input({ birthDate: "2027-01-25" }), data, { scenario: "current" });
    for (const id of ["child-allowance", "parent-pay", "first-meeting-voucher"]) {
      const it0 = r.rows.flatMap((x) => x.items).find((x) => x.benefitId === id)!;
      expect(it0.auto, id).toBe(true);
    }
    const before = computeTimeline(input({ birthDate: "2027-01-20" }), data, { scenario: "current" });
    expect(before.rows[0]!.items.find((x) => x.benefitId === "parent-pay")!.auto).toBe(false);
  });

  it("T13 2026-11-01 출생, 화성, 거주 90일 → 180일 충족 시점에 지급", () => {
    const r = computeTimeline(
      input({ birthDate: "2026-11-01", sido: "경기도", sigungu: "화성시", moveInDate: "2026-08-03" }),
      data,
      { scenario: "current" },
    );
    expect(at(r, 1, "gyeonggi-hwaseong-birth-grant")).toHaveLength(0);
    const item = at(r, 2, "gyeonggi-hwaseong-birth-grant")[0]!;
    expect(r.rows[2]!.month).toBe("2027-01");
    expect(item.amount).toBe(1000000);
    expect(item.deferred).toContain("2027년 1월");
  });

  it("T14 쌍둥이 첫 출산, 서울 → 산후조리경비 100 + 120 = 220만 원", () => {
    const r = computeTimeline(input({ sigungu: "강서구", multiples: 2 }), data, { scenario: "current" });
    expect(sumOf(r, "seoul-postpartum-care")).toBe(2200000);
    expect(sumOf(r, "first-meeting-voucher")).toBe(5000000);
  });

  it("T15 어린이집 생후 12개월 시작 → 부모급여 50만 − 1세반 보육료 51만 5천 원 = 현금 0원", () => {
    const r = computeTimeline(input({ care: { daycareFrom: 12 } }), data, { scenario: "current" });
    expect(at(r, 11, "parent-pay")[0]!.amount).toBe(1000000);
    const m12 = at(r, 12, "parent-pay")[0]!;
    expect(m12.amount).toBe(0);
    expect(m12.formula).toContain("현금 차액 없음");
    const r0 = computeTimeline(input({ care: { daycareFrom: 3 } }), data, { scenario: "current" });
    expect(at(r0, 3, "parent-pay")[0]!.amount).toBe(416000);
  });
});

describe("지자체 육아휴직 장려금", () => {
  it("강남구 아빠 장려금은 아빠 휴직 월에만, 6+6이면 제외", () => {
    const dad: ParentInput = { employment: "insured", wage: 3000000, leave: { startMonth: 3, months: 4 } };
    const r = computeTimeline(input({ father: dad }), data, { scenario: "current" });
    expect([3, 4, 5, 6].map((a) => at(r, a, "seoul-gangnam-dad-leave")[0]?.amount)).toEqual([300000, 300000, 300000, 300000]);
    expect(at(r, 7, "seoul-gangnam-dad-leave")).toHaveLength(0);

    const mom: ParentInput = { employment: "insured", wage: 3000000, leave: { startMonth: 0, months: 6 } };
    const both = computeTimeline(input({ mother: mom, father: dad }), data, { scenario: "current" });
    expect(sumOf(both, "seoul-gangnam-dad-leave")).toBe(0);
    expect(both.excluded.some((e) => e.benefit.id === "seoul-gangnam-dad-leave")).toBe(true);
  });
});
