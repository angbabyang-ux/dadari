// 입력값과 화면 설정을 URL 쿼리스트링으로 직렬화·복원한다 (URL이 단일 진실 공급원)
import type { AllowanceTier } from "../data/schema";
import type { Employment, Input, ParentInput, Scenario } from "../engine/types";
import { regions } from "../data";

/** 입력이 아직 다 채워지지 않았을 수 있는 초안 */
export type Draft = Omit<Input, "birthDate" | "sido"> & { birthDate: string; sido: string };

export const emptyDraft: Draft = {
  birthDate: "",
  expected: false,
  birthOrder: 1,
  multiples: 1,
  care: {},
  sido: "",
  householdSize: 3,
  homeless: false,
  singleParent: false,
  mother: { employment: "insured", wage: 0 },
  father: { employment: "insured", wage: 0 },
};

const EMP: Record<string, Employment> = { i: "insured", s: "uninsured-self", n: "none" };
const EMP_R: Record<Employment, string> = { insured: "i", "uninsured-self": "s", none: "n" };
const TIERS: AllowanceTier[] = ["capital", "non-capital", "depop-preferred", "depop-special"];

function num(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function sidoById(id: string | null) {
  return regions.sidoList.find((s) => s.id === id);
}

function parentFrom(p: URLSearchParams, k: "m" | "f"): ParentInput {
  const emp = EMP[p.get(`${k}e`) ?? "i"] ?? "insured";
  const wage = (num(p.get(`${k}w`)) ?? 0) * 10000;
  const l = p.get(`${k}l`);
  let leave: ParentInput["leave"];
  if (l) {
    const [s, m] = l.split("-").map(Number);
    if (Number.isFinite(s) && Number.isFinite(m) && m! > 0) leave = { startMonth: s!, months: m! };
  }
  return { employment: emp, wage, leave };
}

export function draftFromParams(p: URLSearchParams): Draft {
  const sido = sidoById(p.get("sd"));
  const sg = regions.sigungu.find((r) => r.id === p.get("sg"));
  const tier = p.get("tr");
  return {
    birthDate: p.get("b") ?? "",
    expected: p.get("e") === "1",
    birthOrder: Math.min(5, Math.max(1, num(p.get("o")) ?? 1)),
    multiples: Math.min(4, Math.max(1, num(p.get("mb")) ?? 1)),
    care: {
      daycareFrom: num(p.get("dc")),
      kindergartenFrom: num(p.get("kg")),
      kindergartenKind: p.get("kk") === "pub" ? "public" : p.get("kk") === "pri" ? "private" : undefined,
    },
    sido: sido?.name ?? "",
    sigungu: sg && sg.sido === sido?.name ? sg.sigungu : undefined,
    tierOverride: TIERS.includes(tier as AllowanceTier) ? (tier as AllowanceTier) : undefined,
    moveInDate: p.get("mv") || undefined,
    householdSize: Math.min(7, Math.max(2, num(p.get("hs")) ?? 3)),
    monthlyIncome: num(p.get("inc")) !== undefined ? num(p.get("inc"))! * 10000 : undefined,
    homeless: p.get("hl") === "1",
    jeonse: num(p.get("js")) !== undefined ? num(p.get("js"))! * 10000 : undefined,
    monthlyRent: num(p.get("rt")) !== undefined ? num(p.get("rt"))! * 10000 : undefined,
    singleParent: p.get("sp") === "1",
    mother: parentFrom(p, "m"),
    father: parentFrom(p, "f"),
  };
}

export function draftToParams(d: Draft, extra?: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | number | undefined | false) => {
    if (v !== undefined && v !== false && v !== "") p.set(k, String(v));
  };
  set("b", d.birthDate);
  set("e", d.expected && "1");
  if (d.birthOrder !== 1) set("o", d.birthOrder);
  if (d.multiples !== 1) set("mb", d.multiples);
  set("dc", d.care.daycareFrom);
  set("kg", d.care.kindergartenFrom);
  if (d.care.kindergartenFrom !== undefined) set("kk", d.care.kindergartenKind === "public" ? "pub" : "pri");
  const sido = regions.sidoList.find((s) => s.name === d.sido);
  set("sd", sido?.id);
  set("sg", regions.sigungu.find((r) => r.sido === d.sido && r.sigungu === d.sigungu)?.id);
  set("tr", d.tierOverride);
  set("mv", d.moveInDate);
  if (d.householdSize !== 3) set("hs", d.householdSize);
  if (d.monthlyIncome !== undefined) set("inc", Math.round(d.monthlyIncome / 10000));
  set("hl", d.homeless && "1");
  if (d.jeonse !== undefined) set("js", Math.round(d.jeonse / 10000));
  if (d.monthlyRent !== undefined) set("rt", Math.round(d.monthlyRent / 10000));
  set("sp", d.singleParent && "1");
  for (const [k, par] of [["m", d.mother], ["f", d.father]] as const) {
    if (par.employment !== "insured") set(`${k}e`, EMP_R[par.employment]);
    if (par.wage) set(`${k}w`, Math.round(par.wage / 10000));
    if (par.leave) set(`${k}l`, `${par.leave.startMonth}-${par.leave.months}`);
  }
  for (const [k, v] of Object.entries(extra ?? {})) set(k, v);
  return p.toString();
}

export function isComplete(d: Draft): d is Input {
  return /^\d{4}-\d{2}-\d{2}$/.test(d.birthDate) && d.sido !== "";
}

export function scenarioFrom(p: URLSearchParams): Scenario {
  return p.get("sc") === "p" ? "with-proposals" : "current";
}

/** 결과 화면 고유 설정(시나리오·필터)을 유지한 채 입력값만 바꾼 쿼리 */
export function withDraft(p: URLSearchParams, d: Draft): string {
  return draftToParams(d, { sc: p.get("sc") ?? undefined, f: p.get("f") ?? undefined, cmp: p.get("cmp") ?? undefined });
}
