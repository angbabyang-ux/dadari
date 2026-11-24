// 육아휴직 스위치를 켜고 끌 때 총액 차이가 엔진 계산과 정확히 같은지 검사하는 테스트
import { describe, expect, it } from "vitest";
import { benefits, leaveRules, reference, regions } from "../../src/data";
import { computeTimeline } from "../../src/engine/timeline";
import type { Input } from "../../src/engine/types";
import { applyPlan, availablePlans, defaultPlan, isLeaveItem, leaveBundle, leaveDeadline, leaveDelta, type LeavePlan } from "../../src/ui/result/leavePlan";

const data = { benefits, regions, leaveRules, reference };
const base: Input = {
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
  mother: { employment: "insured", wage: 3000000 },
  father: { employment: "insured", wage: 4000000 },
};
const sum = (i: Input) => computeTimeline(i, data, { scenario: "current" }).rows.reduce((a, r) => a + r.total, 0);

describe("육아휴직 스위치", () => {
  const cases: [string, Input, LeavePlan][] = [
    ["강남구 엄마만", base, "m"],
    ["강남구 아빠만 (구 장려금 포함)", base, "f"],
    ["강남구 둘 다 6+6 (구 장려금 제외)", base, "b"],
    ["파주시 아빠만", { ...base, sido: "경기도", sigungu: "파주시" }, "f"],
    ["입력한 휴직 기간 우선", { ...base, mother: { ...base.mother, leave: { startMonth: 2, months: 9 } } }, "m"],
  ];

  it.each(cases)("%s: 켠 총액 − 끈 총액 = 엔진 총액 차이", (_n, input, plan) => {
    const d = leaveDelta(input, plan, "current");
    expect(d.on).toBe(sum(applyPlan(input, plan)));
    expect(d.off).toBe(sum(applyPlan(input, "off")));
    expect(d.delta).toBe(d.on - d.off);
    expect(d.delta).toBeGreaterThan(0);
  });

  it.each(cases)("%s: 차이는 휴직 관련 항목(휴직 급여·지자체 장려금) 합과 같다", (_n, input, plan) => {
    const r = computeTimeline(applyPlan(input, plan), data, { scenario: "current" });
    const leaveSum = r.rows.flatMap((x) => x.items).filter(isLeaveItem).reduce((a, c) => a + c.amount, 0);
    expect(leaveDelta(input, plan, "current").delta).toBe(leaveSum);
  });

  it("T1 조건(통상임금 300만, 12개월)이면 증가분은 2,310만 원", () => {
    const input = { ...base, sigungu: "강서구", mother: { employment: "insured" as const, wage: 3000000 } };
    expect(leaveDelta(input, "m", "current").delta).toBe(23100000);
  });

  it("끄면 증가분 0", () => {
    expect(leaveDelta(base, "off", "current").delta).toBe(0);
  });

  it("고용보험이 없는 부모는 고를 수 없다", () => {
    expect(availablePlans({ ...base, father: { employment: "uninsured-self", wage: 0 } })).toEqual(["m"]);
    expect(availablePlans({ ...base, singleParent: true })).toEqual(["m"]);
    expect(availablePlans(base)).toEqual(["m", "f", "b"]);
  });

  it("입력에 휴직 계획이 있으면 그대로 기본값이 된다", () => {
    expect(defaultPlan(base)).toBe("off");
    expect(defaultPlan({ ...base, father: { ...base.father, leave: { startMonth: 0, months: 3 } } })).toBe("f");
  });

  it("6+6 추가분과 신청 기한", () => {
    const applied = applyPlan({ ...base, sigungu: "강서구" }, "b");
    const r = computeTimeline(applied, data, { scenario: "current" });
    const b = leaveBundle(applied, r);
    expect(b.sixPlusSix).toBe(true);
    // 엄마 300만: 6+6 250+250+300+300+300+300=1,700 vs 일반 250×3+200×3=1,350 → +350
    // 아빠 400만: 6+6 250+250+300+350+400+400=1,950 vs 일반 1,350 → +600
    expect(b.sixPlusSixExtra).toBe(9500000);
    expect(b.parents.map((p) => p.deadline)).toEqual(["2028-05-31", "2028-11-30"]);
    expect(leaveDeadline("2026-12-15", 0, 12)).toBe("2028-11-30");
  });
});
