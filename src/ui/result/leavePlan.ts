// 육아휴직 스위치: 휴직 계획을 입력에 적용하고, 켰을 때 늘어나는 금액·묶음 카드·시나리오 비교를 엔진으로 계산한다
import { benefits, leaveRules, reference, regions } from "../../data";
import type { Benefit } from "../../data/schema";
import { computeLeave } from "../../engine/leave";
import { computeTimeline } from "../../engine/timeline";
import type { Input, Item, Result, Scenario } from "../../engine/types";

export type LeavePlan = "off" | "m" | "f" | "b";

const DATA = { benefits, regions, leaveRules, reference };

export function insured(input: Input, who: "mother" | "father"): boolean {
  if (who === "father" && input.singleParent) return false;
  return input[who].employment === "insured";
}

/** 고를 수 있는 휴직 계획: 고용보험 가입 부모 기준 */
export function availablePlans(input: Input): Exclude<LeavePlan, "off">[] {
  const out: Exclude<LeavePlan, "off">[] = [];
  if (insured(input, "mother")) out.push("m");
  if (insured(input, "father")) out.push("f");
  if (out.length === 2) out.push("b");
  return out;
}

/** URL에 계획이 없을 때: 입력한 휴직 계획을 그대로 반영 */
export function defaultPlan(input: Input): LeavePlan {
  const m = !!input.mother.leave && insured(input, "mother");
  const f = !!input.father.leave && insured(input, "father");
  return m && f ? "b" : m ? "m" : f ? "f" : "off";
}

export function planFromParam(v: string | null, input: Input): LeavePlan {
  const avail = availablePlans(input);
  if (v === "off") return "off";
  if (v === "m" || v === "f" || v === "b") return avail.includes(v) ? v : "off";
  const d = defaultPlan(input);
  return d === "off" || avail.includes(d) ? d : "off";
}

export const PLAN_LABEL: Record<Exclude<LeavePlan, "off">, string> = { m: "엄마", f: "아빠", b: "둘 다 (6+6)" };

/** 계획을 입력에 적용. 입력한 휴직 기간이 있으면 그대로 쓰고, 없으면 기본 기간을 넣는다 */
export function applyPlan(input: Input, plan: LeavePlan): Input {
  const mom = input.mother.leave;
  const dad = input.father.leave;
  const with_ = (m?: Input["mother"]["leave"], f?: Input["father"]["leave"]): Input => ({
    ...input,
    mother: { ...input.mother, leave: m },
    father: { ...input.father, leave: f },
  });
  switch (plan) {
    case "off":
      return with_(undefined, undefined);
    case "m":
      return with_(mom ?? { startMonth: 0, months: 12 }, undefined);
    case "f":
      return with_(undefined, dad ?? { startMonth: 0, months: 12 });
    case "b":
      return with_(mom ?? { startMonth: 0, months: 6 }, dad ?? { startMonth: 6, months: 6 });
  }
}

const total = (r: Result) => r.rows.reduce((a, x) => a + x.total, 0);

export function isLeaveItem(it: Pick<Item, "category" | "tags">): boolean {
  return it.category === "leave-pay" || it.tags.includes("parental-leave");
}

/** 휴직을 켰을 때와 껐을 때 총액 차이 (둘 다 엔진 계산값) */
export function leaveDelta(input: Input, plan: LeavePlan, scenario: Scenario): { on: number; off: number; delta: number } {
  const on = total(computeTimeline(applyPlan(input, plan), DATA, { scenario }));
  const off = total(computeTimeline(applyPlan(input, "off"), DATA, { scenario }));
  return { on, off, delta: on - off };
}

export type ParentLeaveRow = {
  parent: "mother" | "father";
  total: number;
  months: number;
  from: string; // YYYY-MM
  to: string;
  deadline: string; // YYYY-MM-DD 신청 마감
};

export type LeaveBundle = {
  parents: ParentLeaveRow[];
  payTotal: number;
  sixPlusSix: boolean;
  sixPlusSixExtra: number; // 6+6이 없었다면 대비 늘어난 휴직 급여
  local: { benefit: Benefit; total: number; months: number }[];
  localExcluded: { benefit: Benefit; reason: string }[];
  info: Benefit[]; // 근로시간 단축·배우자 출산휴가 (금액 계산 없음)
  warnings: string[];
};

function ymOfAge(birthDate: string, age: number): string {
  const y = Number(birthDate.slice(0, 4));
  const m = Number(birthDate.slice(5, 7)) - 1 + age;
  return `${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
}

/** 휴직 종료 후 12개월이 되는 날 (휴직 마지막 달 말일 + 12개월) */
export function leaveDeadline(birthDate: string, startMonth: number, months: number): string {
  const y = Number(birthDate.slice(0, 4));
  const m0 = Number(birthDate.slice(5, 7)) - 1 + startMonth + months; // 휴직 다음 달 (0부터)
  const end = new Date(Date.UTC(y, m0, 0)); // 휴직 마지막 달 말일
  const dl = new Date(Date.UTC(end.getUTCFullYear() + 1, end.getUTCMonth(), end.getUTCDate()));
  return dl.toISOString().slice(0, 10);
}

export function leaveBundle(applied: Input, result: Result): LeaveBundle {
  const items = result.rows.flatMap((r) => r.items);
  const parents: ParentLeaveRow[] = [];
  for (const who of ["mother", "father"] as const) {
    const ms = result.leave.months.filter((m) => m.parent === who);
    const lv = applied[who].leave;
    if (ms.length === 0 || !lv) continue;
    parents.push({
      parent: who,
      total: ms.reduce((a, m) => a + m.amount, 0),
      months: ms.length,
      from: ymOfAge(applied.birthDate, ms[0]!.ageMonths),
      to: ymOfAge(applied.birthDate, ms.at(-1)!.ageMonths),
      deadline: leaveDeadline(applied.birthDate, lv.startMonth, ms.length),
    });
  }
  const payTotal = parents.reduce((a, p) => a + p.total, 0);
  const without = computeLeave(applied, leaveRules, { disableSixPlusSix: true }).months.reduce((a, m) => a + m.amount, 0);

  const localMap = new Map<string, { benefit: Benefit; total: number; months: number }>();
  for (const it of items) {
    if (it.category === "leave-pay" || !it.tags.includes("parental-leave")) continue;
    const b = benefits.find((x) => x.id === it.benefitId)!;
    const g = localMap.get(b.id) ?? { benefit: b, total: 0, months: 0 };
    g.total += it.amount;
    g.months += 1;
    localMap.set(b.id, g);
  }
  const localExcluded = result.excluded
    .filter((e) => e.benefit.schedule.type === "perLeaveMonth" && !localMap.has(e.benefit.id))
    .filter((e, i, arr) => arr.findIndex((x) => x.benefit.id === e.benefit.id) === i);
  const info = ["reduced-hours-pay", "paternity-leave-pay"].map((id) => benefits.find((b) => b.id === id)!).filter(Boolean);

  return {
    parents,
    payTotal,
    sixPlusSix: result.leave.sixPlusSix,
    sixPlusSixExtra: result.leave.sixPlusSix ? payTotal - without : 0,
    local: [...localMap.values()],
    localExcluded,
    info,
    warnings: result.leave.warnings,
  };
}

export type ScenarioRow = { key: string; label: string; pay: number; local: number; total: number; sixPlusSix: boolean };

const SCENARIOS: { key: string; label: string; mother?: [number, number]; father?: [number, number] }[] = [
  { key: "mom12", label: "엄마만 12개월", mother: [0, 12] },
  { key: "seq", label: "6+6 순차", mother: [0, 6], father: [6, 6] },
  { key: "same", label: "6+6 동시", mother: [0, 6], father: [0, 6] },
  { key: "dad", label: "아빠 먼저", father: [0, 6], mother: [6, 6] },
];

/** 휴직 조합별로 휴직 급여 + 지자체 장려금 합계를 비교한다 */
export function compareScenarios(input: Input, scenario: Scenario): ScenarioRow[] {
  return SCENARIOS.map((s) => {
    const i: Input = {
      ...input,
      mother: { ...input.mother, leave: s.mother ? { startMonth: s.mother[0], months: s.mother[1] } : undefined },
      father: { ...input.father, leave: s.father ? { startMonth: s.father[0], months: s.father[1] } : undefined },
    };
    const r = computeTimeline(i, DATA, { scenario });
    const its = r.rows.flatMap((x) => x.items);
    const pay = its.filter((x) => x.category === "leave-pay").reduce((a, c) => a + c.amount, 0);
    const local = its.filter((x) => x.category !== "leave-pay" && x.tags.includes("parental-leave")).reduce((a, c) => a + c.amount, 0);
    return { key: s.key, label: s.label, pay, local, total: pay + local, sixPlusSix: r.leave.sixPlusSix };
  });
}
