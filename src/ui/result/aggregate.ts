// 엔진 결과를 화면용으로 묶는다: 필터, 요약 합계, 시기별·제도별 묶음
import type { Benefit } from "../../data/schema";
import type { Item, MonthRow } from "../../engine/types";
import { benefits } from "../../data";

export type FilterKey = "all" | "cash" | "voucher" | "leave" | "local" | "apply";

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "cash", label: "현금만" },
  { key: "voucher", label: "바우처·상품권" },
  { key: "leave", label: "육아휴직 관련" },
  { key: "local", label: "지자체 지원만" },
  { key: "apply", label: "신청 필요" },
];

export const benefitById = new Map<string, Benefit>(benefits.map((b) => [b.id, b]));

export function passes(item: Item, f: FilterKey, includeUnconfirmed: boolean): boolean {
  if (!includeUnconfirmed && item.status !== "confirmed") return false;
  switch (f) {
    case "all":
      return true;
    case "cash":
      return item.category === "cash";
    case "voucher":
      return item.category === "voucher" || item.category === "local-currency";
    case "leave":
      return item.category === "leave-pay" || item.tags.includes("parental-leave");
    case "local":
      return item.level !== "national";
    case "apply":
      return !item.auto;
  }
}

export function filterRows(rows: MonthRow[], f: FilterKey, includeUnconfirmed: boolean): MonthRow[] {
  return rows.map((r) => {
    const items = r.items.filter((i) => passes(i, f, includeUnconfirmed));
    return { ...r, items, total: items.reduce((a, c) => a + c.amount, 0) };
  });
}

export type Summary = {
  total: number;
  cash: number;
  voucher: number; // 바우처
  localCurrency: number; // 지역화폐·상품권
  leave: number; // 육아휴직 급여
  national: number;
  sido: number;
  sigungu: number;
  unconfirmed: number; // 확인 필요·정부안 몫
};

export function summarize(rows: MonthRow[]): Summary {
  const s: Summary = { total: 0, cash: 0, voucher: 0, localCurrency: 0, leave: 0, national: 0, sido: 0, sigungu: 0, unconfirmed: 0 };
  for (const it of rows.flatMap((r) => r.items)) {
    s.total += it.amount;
    if (it.category === "cash") s.cash += it.amount;
    else if (it.category === "voucher") s.voucher += it.amount;
    else if (it.category === "local-currency") s.localCurrency += it.amount;
    else if (it.category === "leave-pay") s.leave += it.amount;
    s[it.level] += it.amount;
    if (it.status !== "confirmed") s.unconfirmed += it.amount;
  }
  return s;
}

export type Period = { key: string; title: string; from: number; to: number };

export const PERIODS: Period[] = [
  { key: "birth", title: "출생 직후 받는 것", from: 0, to: 3 },
  { key: "age0", title: "0세 동안", from: 3, to: 12 },
  { key: "age1", title: "1세", from: 12, to: 24 },
  { key: "age2-5", title: "2~5세", from: 24, to: 72 },
  { key: "preschool", title: "입학 전", from: 72, to: 999 },
];

export type BenefitGroup = {
  benefit: Benefit;
  total: number;
  months: number; // 지급되는 달 수
  firstMonth: string;
  lastMonth: string;
  items: Item[];
  monthlyAmount?: number; // 매달 같은 금액이면 그 금액
};

/** 한 시기 안에서 제도별로 묶는다. 매달 받는 제도(월 수당)는 출생 직후 묶음에 넣지 않고 0세부터 보여준다 */
export function groupByPeriod(rows: MonthRow[]): { period: Period; groups: BenefitGroup[]; total: number }[] {
  const monthlyIds = new Set(benefits.filter((b) => b.schedule.type === "monthly" || b.schedule.type === "classAge" || b.schedule.type === "formula" || b.schedule.type === "perLeaveMonth").map((b) => b.id));
  return PERIODS.map((period) => {
    const map = new Map<string, BenefitGroup>();
    for (const r of rows) {
      for (const it of r.items) {
        const isMonthly = monthlyIds.has(it.benefitId);
        // 월 수당은 0~11개월을 "0세 동안"으로, 일시금은 실제 지급 시기로 분류
        const age = r.ageMonths;
        const inPeriod = isMonthly
          ? period.key === "birth"
            ? false
            : period.key === "age0"
              ? age < 12
              : age >= period.from && age < period.to
          : age >= period.from && age < period.to;
        if (!inPeriod) continue;
        const b = benefitById.get(it.benefitId);
        if (!b) continue;
        const g = map.get(b.id) ?? { benefit: b, total: 0, months: 0, firstMonth: r.month, lastMonth: r.month, items: [] };
        g.total += it.amount;
        g.items.push(it);
        g.lastMonth = r.month;
        map.set(b.id, g);
      }
    }
    const groups = [...map.values()].map((g) => {
      const amounts = new Set(g.items.map((i) => i.amount));
      return { ...g, months: g.items.length, monthlyAmount: monthlyIds.has(g.benefit.id) && amounts.size === 1 ? g.items[0]!.amount : undefined };
    });
    groups.sort((a, b) => b.total - a.total);
    return { period, groups, total: groups.reduce((a, g) => a + g.total, 0) };
  }).filter((p) => p.groups.length > 0);
}

export const CATEGORY_LABEL: Record<Benefit["category"], string> = {
  cash: "현금",
  voucher: "바우처",
  "local-currency": "지역화폐·상품권",
  service: "서비스",
  tax: "세금·자산",
  "leave-pay": "휴직 급여",
};

export const LEVEL_LABEL: Record<Benefit["level"], string> = { national: "국가", sido: "시·도", sigungu: "시·군·구" };

export const STATUS_LABEL: Record<Benefit["status"], string> = { confirmed: "확정", proposed: "정부안", ended: "종료", "needs-check": "확인 필요" };
