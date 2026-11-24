// 부모별 육아휴직 계획을 월별 급여로 펼치는 계산 (일반·6+6·한부모·18개월 연장)
import type { LeaveRules } from "../data/schema";
import type { Input, LeaveMonth, LeaveResult } from "./types";

type Band = LeaveRules["general"][number];

function bandFor(bands: Band[], k: number): Band {
  const b = bands.find((x) => k >= x.fromMonth && k <= x.toMonth) ?? bands[bands.length - 1];
  if (!b) throw new Error("육아휴직 급여 구간 데이터가 비어 있어요");
  return b;
}

/** 월 급여 = max(하한, min(상한, 통상임금 × 지급률)) */
export function monthlyLeavePay(wage: number, rate: number, cap: number, floor: number): number {
  return Math.max(floor, Math.min(cap, Math.round(wage * rate)));
}

/** opts.disableSixPlusSix: "6+6이 없었다면" 금액을 구할 때만 쓴다 (화면의 6+6 추가분 표시용) */
export function computeLeave(input: Input, rules: LeaveRules, opts: { disableSixPlusSix?: boolean } = {}): LeaveResult {
  const warnings: string[] = [];
  const { mother, father } = input;
  const insured = (p: Input["mother"]) => p.employment === "insured" && !!p.leave && p.leave.months > 0;

  // 6+6: 한부모가 아니고, 두 부모 모두 자녀 생후 18개월 이내에 시작한 휴직이 있을 것
  const within = (p: Input["mother"]) => insured(p) && p.leave!.startMonth < rules.sixPlusSix.withinChildMonths;
  const sixPlusSix = !opts.disableSixPlusSix && !input.singleParent && within(mother) && within(father);

  // 기본 12개월. 부모 각각 3개월 이상 쓰면 각자 18개월. 한부모는 조건 없이 18개월
  const eachUsesMin =
    insured(mother) && insured(father) && mother.leave!.months >= rules.extensionMinEachMonths && father.leave!.months >= rules.extensionMinEachMonths;
  const allowed = input.singleParent || eachUsesMin ? rules.extendedMonths : rules.baseMonths;

  const months: LeaveMonth[] = [];
  for (const who of ["mother", "father"] as const) {
    const p = input[who];
    if (!p.leave || p.leave.months <= 0) continue;
    if (p.employment !== "insured") {
      warnings.push(`${who === "mother" ? "엄마" : "아빠"}는 고용보험 가입자가 아니라 육아휴직 급여 대상이 아니에요.`);
      continue;
    }
    let count = p.leave.months;
    if (count > allowed) {
      warnings.push(`${who === "mother" ? "엄마" : "아빠"}의 휴직 ${count}개월 중 ${allowed}개월까지만 급여가 나와요.`);
      count = allowed;
    }
    for (let k = 1; k <= count; k++) {
      let rule: LeaveMonth["rule"] = "general";
      let rate: number;
      let cap: number;
      if (sixPlusSix && k <= rules.sixPlusSix.caps.length) {
        rule = "six-plus-six";
        rate = rules.sixPlusSix.rate;
        cap = rules.sixPlusSix.caps[k - 1]!;
      } else {
        const bands = input.singleParent ? rules.singleParent : rules.general;
        if (input.singleParent) rule = "single-parent";
        const b = bandFor(bands, k);
        rate = b.rate;
        cap = b.cap;
      }
      months.push({
        parent: who,
        index: k,
        ageMonths: p.leave.startMonth + k - 1,
        amount: monthlyLeavePay(p.wage, rate, cap, rules.floor),
        cap,
        rule,
      });
    }
  }
  return { sixPlusSix, allowedMonths: { mother: allowed, father: allowed }, months, warnings };
}
