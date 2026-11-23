// 출생일과 거주지로 출생월부터 입학 직전 2월까지 월별 지원금 타임라인을 계산하는 엔진
import { addDays, parseISO } from "date-fns";
import type { AllowanceTier, Benefit, EligibilityRule, LeaveRules, Reference, RegionsFile } from "../data/schema";
import { computeLeave } from "./leave";
import { formatWon } from "./money";
import type { Excluded, Input, Item, MonthRow, Result, Scenario } from "./types";

export type EngineData = { benefits: Benefit[]; regions: RegionsFile; leaveRules: LeaveRules; reference: Reference };

type Ym = { y: number; m: number }; // m: 1~12

function ymOf(iso: string): Ym {
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) };
}
function addMonths(a: Ym, n: number): Ym {
  const t = a.y * 12 + (a.m - 1) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}
function ymKey(a: Ym): string {
  return `${a.y}-${String(a.m).padStart(2, "0")}`;
}
function monthDiff(from: Ym, to: Ym): number {
  return (to.y - from.y) * 12 + (to.m - from.m);
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 타임라인 길이: 출생월 ~ (출생연도+7)년 2월 */
export function timelineLength(birthDate: string): number {
  const b = ymOf(birthDate);
  return monthDiff(b, { y: b.y + 7, m: 2 }) + 1;
}

export function tierFor(input: Input, regions: RegionsFile): AllowanceTier {
  if (input.tierOverride) return input.tierOverride;
  const r = regions.sigungu.find((x) => x.sido === input.sido && x.sigungu === input.sigungu);
  if (r) return r.allowanceTier;
  const sido = regions.sidoList.find((s) => s.name === input.sido);
  return sido?.capital === false ? "non-capital" : "capital";
}

function regionMatches(b: Benefit, input: Input): boolean {
  if (!b.region) return true;
  if (b.region.sido !== input.sido) return false;
  return !b.region.sigungu || b.region.sigungu === input.sigungu;
}

function inRange(date: string, r?: { from?: string; to?: string }): boolean {
  if (!r) return true;
  if (r.from && date < r.from) return false;
  if (r.to && date > r.to) return false;
  return true;
}

/** 소득 % 계산: 해당 연도 기준 중위소득 대비. 자료가 없는 연도는 가장 가까운 연도 사용 */
export function incomePercent(income: number, householdSize: number, year: number, ref: Reference): number | undefined {
  const years = Object.keys(ref.medianIncome).map(Number).sort((a, b) => a - b);
  if (years.length === 0) return undefined;
  const y = years.reduce((best, cur) => (Math.abs(cur - year) < Math.abs(best - year) ? cur : best), years[0]!);
  const table = ref.medianIncome[String(y)]!;
  const sizes = Object.keys(table).map(Number);
  const size = Math.min(Math.max(householdSize, Math.min(...sizes)), Math.max(...sizes));
  const median = table[String(size)];
  return median ? (income / median) * 100 : undefined;
}

type Ctx = {
  input: Input;
  data: EngineData;
  birth: Ym;
  n: number;
  tier: AllowanceTier;
  moveIn: string;
  leave: ReturnType<typeof computeLeave>;
  facilityAt: (age: number) => "home" | "daycare" | "public" | "private";
};

type Gate = { ok: true; fromIndex: number; deferred?: string; conditional?: string } | { ok: false; reason: string };

/** 지급 시작 월(index) 기준으로 자격을 판정한다. fromIndex: 이 월 이후부터 지급 가능 */
function checkEligibility(rules: EligibilityRule[], ctx: Ctx, order: number, payIndex: number): Gate {
  const { input } = ctx;
  let fromIndex = 0;
  let deferred: string | undefined;
  let conditional: string | undefined;
  for (const r of rules) {
    switch (r.type) {
      case "birthOrder":
        if ((r.min && order < r.min) || (r.max && order > r.max)) return { ok: false, reason: "출생순위 조건에 해당하지 않아요." };
        break;
      case "incomePct": {
        if (input.monthlyIncome === undefined) {
          conditional = `기준 중위소득 ${r.max}% 이하일 때 받아요. 소득을 입력하면 판정해요.`;
          break;
        }
        const year = addMonths(ctx.birth, payIndex).y;
        const pct = incomePercent(input.monthlyIncome, input.householdSize, year, ctx.data.reference);
        if (pct !== undefined && pct > r.max) return { ok: false, reason: `가구 소득이 기준 중위소득의 ${Math.round(pct)}%로 ${r.max}% 기준을 넘어요.` };
        break;
      }
      case "residence": {
        const eligibleDate = isoOf(addDays(parseISO(ctx.moveIn), r.days));
        const eligibleIndex = monthDiff(ctx.birth, ymOf(eligibleDate));
        if (r.ref === "birth" && eligibleDate <= input.birthDate) break;
        if (r.ref === "apply" && eligibleIndex <= payIndex) break;
        if (!r.deferIfShort) {
          return { ok: false, reason: `${r.ref === "birth" ? "출생일" : "신청일"} 기준 ${r.days}일 이상 거주해야 해요.` };
        }
        if (eligibleIndex > fromIndex) {
          fromIndex = eligibleIndex;
          const ym = ymOf(eligibleDate);
          deferred = `거주 ${r.days}일을 채우는 ${ym.y}년 ${ym.m}월부터 받을 수 있어요.`;
        }
        break;
      }
      case "expectedOnly":
        if (!input.expected) return { ok: false, reason: "임신 중에만 신청할 수 있어요." };
        break;
      case "homeless": {
        if (!input.homeless) return { ok: false, reason: "무주택 가구만 받을 수 있어요." };
        const jeonseOk = input.jeonse !== undefined && input.jeonse <= r.maxJeonse;
        const rentOk = input.monthlyRent !== undefined && input.monthlyRent <= r.maxMonthlyEquiv;
        if (input.jeonse === undefined && input.monthlyRent === undefined) {
          conditional = `전세 ${formatWon(r.maxJeonse)} 이하 또는 월세 ${formatWon(r.maxMonthlyEquiv)} 이하 주택일 때 받아요.`;
        } else if (!jeonseOk && !rentOk) {
          return { ok: false, reason: "전세가 또는 월세가 기준을 넘어요." };
        }
        break;
      }
      case "singleParent":
        if (!input.singleParent) return { ok: false, reason: "한부모 가구만 받을 수 있어요." };
        break;
      case "multipleBirth":
        if (input.multiples < 2) return { ok: false, reason: "다태아 가정만 받을 수 있어요." };
        break;
      case "employment": {
        const who = r.parent === "either" ? [input.mother, input.father] : [input[r.parent]];
        if (!who.some((p) => r.anyOf.includes(p.employment))) return { ok: false, reason: "고용 형태 조건에 해당하지 않아요." };
        break;
      }
    }
  }
  return { ok: true, fromIndex, deferred, conditional };
}

function pickByOrder<T>(arr: T[], order: number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.min(order, arr.length) - 1];
}

export function computeTimeline(input: Input, data: EngineData, opts: { scenario: Scenario }): Result {
  const birth = ymOf(input.birthDate);
  const n = timelineLength(input.birthDate);
  const rows: MonthRow[] = Array.from({ length: n }, (_, i) => ({ month: ymKey(addMonths(birth, i)), ageMonths: i, items: [], total: 0 }));
  const excluded: Excluded[] = [];
  const ended: Excluded[] = [];
  const info: Benefit[] = [];
  const afterSchool: Item[] = [];
  const leave = computeLeave(input, data.leaveRules);
  const moveIn = input.moveInDate ?? isoOf(addDays(parseISO(input.birthDate), -366));
  const { care } = input;
  const facilityAt = (age: number): "home" | "daycare" | "public" | "private" => {
    if (care.kindergartenFrom !== undefined && age >= care.kindergartenFrom) return care.kindergartenKind === "public" ? "public" : "private";
    if (care.daycareFrom !== undefined && age >= care.daycareFrom) return "daycare";
    return "home";
  };
  const ctx: Ctx = { input, data, birth, n, tier: tierFor(input, data.regions), moveIn, leave, facilityAt };
  let pendingReform = false;

  const children = Array.from({ length: Math.max(1, input.multiples) }, (_, k) => ({ index: k + 1, order: input.birthOrder + k }));

  const push = (index: number, item: Item, calendar?: { from?: string; to?: string }) => {
    const ym = addMonths(birth, index);
    const firstDay = `${ymKey(ym)}-01`;
    if (calendar && !inRange(firstDay, { from: calendar.from ? calendar.from.slice(0, 7) + "-01" : undefined, to: calendar.to })) return;
    if (index >= n) {
      afterSchool.push(item);
      return;
    }
    // 금액 0원 행은 "보육료 차감 후 현금 차액 없음"처럼 이유를 보여줘야 할 때만 남는다
    if (index < 0 || item.amount < 0) return;
    rows[index]!.items.push(item);
  };

  for (const b of data.benefits) {
    if (!regionMatches(b, input)) continue;
    if (!inRange(input.birthDate, b.birthDateRange)) continue;
    let mayChange: string | undefined;
    if (b.supersededFrom && input.birthDate >= b.supersededFrom) {
      if (opts.scenario === "with-proposals") {
        excluded.push({ benefit: b, reason: "정부안이 통과되면 아이맞이지원금·아동기본수당으로 바뀌어요." });
        continue;
      }
      pendingReform = true;
      mayChange = "2027년 7월 개편 정부안이 국회를 통과하면 새 제도로 바뀔 수 있어요.";
    }

    if (b.status === "ended") {
      ended.push({ benefit: b, reason: b.summary });
      continue;
    }
    if (b.status === "proposed" && opts.scenario === "current") {
      excluded.push({ benefit: b, reason: "정부안이라 '정부안 포함'을 켜야 계산에 들어가요." });
      continue;
    }
    const s = b.schedule;
    if (s.type === "info") {
      const gate = checkEligibility(b.eligibility, ctx, input.birthOrder, 0);
      if (gate.ok) info.push(b);
      else excluded.push({ benefit: b, reason: gate.reason });
      continue;
    }

    const auto = !!b.apply.auto || (!!b.apply.autoFromBirth && input.birthDate >= b.apply.autoFromBirth);
    const base = { benefitId: b.id, name: b.name, category: b.category, status: b.status, level: b.level, tags: b.tags, auto, mayChange };

    if (s.type === "lumpSum") {
      const targets = s.perChild ? children : [{ index: 0, order: input.birthOrder }];
      for (const c of targets) {
        const total = pickByOrder(s.amountsByOrder, c.order);
        if (total == null) {
          if (!s.perChild || c.index === 1) excluded.push({ benefit: b, reason: "이 출생순위는 지원 대상이 아니에요." });
          continue;
        }
        const gate = checkEligibility(b.eligibility, ctx, c.order, s.firstOffsetMonths);
        if (!gate.ok) {
          excluded.push({ benefit: b, reason: gate.reason });
          continue;
        }
        const explicit = s.installmentsByOrder ? pickByOrder(s.installmentsByOrder, c.order) : undefined;
        let parts: { offset: number; amount: number }[];
        if (explicit) {
          parts = explicit.map((amount, k) => ({ offset: s.firstOffsetMonths + k * (s.intervalMonths ?? 12), amount }));
        } else if (s.split) {
          const each = Math.round(total / s.split.count);
          parts = Array.from({ length: s.split.count }, (_, k) => ({ offset: s.firstOffsetMonths + k * s.split!.intervalMonths, amount: each }));
        } else {
          parts = [{ offset: s.firstOffsetMonths, amount: total }];
        }
        const shift = Math.max(0, gate.fromIndex - s.firstOffsetMonths);
        const orderText = s.amountsByOrder.length > 1 ? `${ordinal(c.order)} ` : "";
        parts.forEach((p, k) => {
          push(
            p.offset + shift,
            {
              ...base,
              amount: p.amount,
              child: s.perChild && children.length > 1 ? c.index : undefined,
              formula: `${orderText}${formatWon(total)}${parts.length > 1 ? ` 중 ${k + 1}/${parts.length}회 ${formatWon(p.amount)}` : ""}`,
              deferred: gate.deferred,
              conditional: gate.conditional,
            },
            b.calendarRange,
          );
        });
      }
      continue;
    }

    if (s.type === "monthly") {
      for (const c of children) {
        const gate = checkEligibility(b.eligibility, ctx, c.order, 0);
        if (!gate.ok) {
          if (c.index === 1) excluded.push({ benefit: b, reason: gate.reason });
          continue;
        }
        for (let age = gate.fromIndex; age < n; age++) {
          const band = s.bands.find((x) => age >= x.fromMonth && age < x.toMonth);
          if (!band) continue;
          const full = band.amount ?? band.amountByTier?.[ctx.tier];
          if (full === undefined) continue;
          const fac = facilityAt(age);
          let amount = full;
          let formula = formatWon(full);
          if (s.childcare === "home-only" && fac !== "home") continue;
          if (s.childcare === "subtract-fee" && fac !== "home") {
            const fee = age < 12 ? data.reference.childcareFee.age0 : data.reference.childcareFee.age1;
            amount = Math.max(0, full - fee);
            formula = `${formatWon(full)} − ${age < 12 ? "0세반" : "1세반"} 보육료 ${formatWon(fee)}`;
            if (amount === 0) formula += " → 현금 차액 없음";
          }
          if (band.amountByTier) formula += ` (${tierLabel(ctx.tier)})`;
          push(age, { ...base, amount, formula, child: children.length > 1 ? c.index : undefined, conditional: gate.conditional }, b.calendarRange);
        }
      }
      continue;
    }

    if (s.type === "classAge") {
      for (const c of children) {
        for (let age = 0; age < n; age++) {
          const ym = addMonths(birth, age);
          const schoolYear = ym.m >= 3 ? ym.y : ym.y - 1;
          const classAge = schoolYear - birth.y - 1;
          if (!(s.ages as number[]).includes(classAge)) continue;
          const fac = facilityAt(age);
          if (fac === "home") continue;
          const key = fac === "daycare" ? "daycare" : fac === "public" ? "publicKindergarten" : "privateKindergarten";
          const amount = s.amountByFacility[key];
          const facName = fac === "daycare" ? "어린이집" : fac === "public" ? "공립유치원" : "사립유치원";
          push(age, { ...base, amount, formula: `만 ${classAge}세반 ${facName} 월 ${formatWon(amount)} 경감`, child: children.length > 1 ? c.index : undefined }, b.calendarRange);
        }
      }
      continue;
    }

    if (s.type === "perLeaveMonth") {
      const gate0 = checkEligibility(b.eligibility, ctx, input.birthOrder, 0);
      if (!gate0.ok) {
        excluded.push({ benefit: b, reason: gate0.reason });
        continue;
      }
      if (s.excludeSixPlusSix && leave.sixPlusSix) {
        excluded.push({ benefit: b, reason: "6+6 부모육아휴직제를 적용받으면 받을 수 없어요." });
        continue;
      }
      const months = leave.months.filter((m) => s.parent === "any" || m.parent === s.parent).slice(0, s.maxMonths);
      if (months.length === 0) {
        excluded.push({ benefit: b, reason: `${s.parent === "father" ? "아빠" : s.parent === "mother" ? "엄마" : "부모"}의 육아휴직 계획이 있을 때 받아요.` });
        continue;
      }
      for (const m of months) {
        const gate = checkEligibility(b.eligibility, ctx, input.birthOrder, m.ageMonths);
        if (!gate.ok) continue;
        push(m.ageMonths, { ...base, amount: s.amount, parent: m.parent, formula: `휴직 ${m.index}개월째 ${formatWon(s.amount)}` }, b.calendarRange);
      }
      continue;
    }

    if (s.type === "formula" && s.formula === "parental-leave") {
      if (leave.months.length === 0) {
        excluded.push({ benefit: b, reason: "육아휴직 계획을 넣으면 계산해요." });
        continue;
      }
      for (const m of leave.months) {
        const wage = input[m.parent].wage;
        const ruleText = m.rule === "six-plus-six" ? "6+6 특례" : m.rule === "single-parent" ? "한부모 특례" : "일반";
        push(m.ageMonths, {
          ...base,
          amount: m.amount,
          parent: m.parent,
          formula: `${ruleText} ${m.index}개월째 · 통상임금 ${formatWon(wage)}, 상한 ${formatWon(m.cap)}, 하한 ${formatWon(data.leaveRules.floor)} → ${formatWon(m.amount)}`,
        });
      }
    }
  }

  for (const r of rows) r.total = r.items.reduce((a, c) => a + c.amount, 0);
  return { rows, excluded, ended, info, leave, pendingReform, afterSchool };
}

export function ordinal(order: number): string {
  return ["첫째", "둘째", "셋째", "넷째"][order - 1] ?? "다섯째 이상";
}

export function tierLabel(t: AllowanceTier): string {
  return { capital: "수도권", "non-capital": "비수도권", "depop-preferred": "인구감소지역 우대", "depop-special": "인구감소지역 특별" }[t];
}
