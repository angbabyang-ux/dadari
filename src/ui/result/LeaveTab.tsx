// 육아휴직 시나리오 비교: 엄마만 12개월 / 6+6 순차 / 6+6 동시 / 아빠 먼저
import { useMemo } from "react";
import { benefits, leaveRules, reference, regions } from "../../data";
import { computeTimeline } from "../../engine/timeline";
import { formatWon } from "../../engine/money";
import type { Input, Scenario } from "../../engine/types";

type Plan = { key: string; label: string; mother?: [number, number]; father?: [number, number] };

const PLANS: Plan[] = [
  { key: "mom12", label: "엄마만 12개월", mother: [0, 12] },
  { key: "seq", label: "6+6 순차 (엄마 → 아빠)", mother: [0, 6], father: [6, 6] },
  { key: "same", label: "6+6 동시", mother: [0, 6], father: [0, 6] },
  { key: "dad", label: "아빠 먼저 (아빠 → 엄마)", father: [0, 6], mother: [6, 6] },
];

export function LeaveTab({ input, scenario }: { input: Input; scenario: Scenario }) {
  const bothInsured = input.mother.employment === "insured" && input.father.employment === "insured" && !input.singleParent;
  const results = useMemo(() => {
    if (!bothInsured) return [];
    return PLANS.map((p) => {
      const i: Input = {
        ...input,
        mother: { ...input.mother, leave: p.mother ? { startMonth: p.mother[0], months: p.mother[1] } : undefined },
        father: { ...input.father, leave: p.father ? { startMonth: p.father[0], months: p.father[1] } : undefined },
      };
      const r = computeTimeline(i, { benefits, regions, leaveRules, reference }, { scenario });
      const items = r.rows.flatMap((x) => x.items);
      const pay = items.filter((x) => x.category === "leave-pay").reduce((a, c) => a + c.amount, 0);
      const local = items.filter((x) => x.category !== "leave-pay" && x.tags.includes("parental-leave")).reduce((a, c) => a + c.amount, 0);
      // 휴직 기간(첫 12개월) 동안 매달 들어오는 돈: 휴직 급여 + 부모급여 등 전체
      const first12 = r.rows.slice(0, 12).map((x) => x.total);
      return { plan: p, pay, local, total: pay + local, sixPlusSix: r.leave.sixPlusSix, first12 };
    });
  }, [input, scenario, bothInsured]);

  if (!bothInsured) {
    return (
      <div className="py-8">
        <p>두 부모 모두 고용보험 가입 근로자일 때 휴직 조합을 비교해요.</p>
        <p className="text-sm text-ink-2 mt-2">한부모 가구는 1~3개월 상한이 300만 원으로 올라가는 한부모 특례가 적용돼요. 입력 4단계에서 휴직 계획을 넣으면 결과에 반영돼요.</p>
      </div>
    );
  }
  if (!input.mother.wage || !input.father.wage) {
    return <p className="py-8">엄마와 아빠의 월 통상임금을 넣으면 휴직 조합별 금액을 비교해요.</p>;
  }
  const best = results.reduce((a, b) => (b.total > a.total ? b : a), results[0]!);
  const max = Math.max(...results.flatMap((r) => r.first12), 1);

  return (
    <div className="pt-6">
      <p className="text-sm text-ink-2">
        통상임금 엄마 {formatWon(input.mother.wage)}, 아빠 {formatWon(input.father.wage)}으로 계산해요. 휴직 급여와 지자체 육아휴직 장려금을 더한 값이에요. 부모급여·아동수당은 어느 조합이든 같아요.
      </p>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm num min-w-[520px]">
          <caption className="sr-only">육아휴직 조합별 금액 비교</caption>
          <thead>
            <tr className="rule-b text-left text-ink-2">
              <th scope="col" className="py-2 font-medium">조합</th>
              <th scope="col" className="py-2 font-medium text-right">휴직 급여</th>
              <th scope="col" className="py-2 font-medium text-right">지자체 장려금</th>
              <th scope="col" className="py-2 font-medium text-right">합계</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.plan.key} className="rule-b">
                <th scope="row" className="py-3 text-left font-semibold">
                  {r.plan.label}
                  {r.sixPlusSix && <span className="badge ml-2 text-ink-2 font-normal">6+6 적용</span>}
                  {r === best && <span className="badge ml-2 text-accent font-normal">가장 많아요</span>}
                </th>
                <td className="py-3 text-right">{formatWon(r.pay)}</td>
                <td className="py-3 text-right">{r.local ? formatWon(r.local) : "—"}</td>
                <td className={`py-3 text-right font-semibold ${r === best ? "text-accent" : ""}`}>{formatWon(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="font-serif text-lg font-semibold mt-8 pb-2 rule-b">첫 12개월, 매달 들어오는 돈</h3>
      <p className="text-sm text-ink-2 pt-2">휴직 급여에 부모급여 같은 다른 지원을 겹쳐 본 월별 합계예요.</p>
      <div className="mt-3 space-y-4">
        {results.map((r) => (
          <div key={r.plan.key}>
            <p className="text-sm font-medium">{r.plan.label}</p>
            <svg width="100%" height="56" viewBox={`0 0 ${12 * 24} 56`} preserveAspectRatio="none" role="img" aria-label={`${r.plan.label} 첫 12개월 월별 합계: ${r.first12.map(formatWon).join(", ")}`}>
              {r.first12.map((v, i) => {
                const h = (v / max) * 52;
                return <rect key={i} x={i * 24 + 3} y={56 - h} width={18} height={h} fill={r === best ? "var(--accent)" : "var(--cash)"} />;
              })}
            </svg>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-2 mt-6">
        육아휴직 급여는 휴직을 시작하고 1개월이 지난 뒤부터, 휴직이 끝나고 12개월 안에 고용24에서 신청해야 해요. 기한을 넘기면 받을 수 없어요.
      </p>
    </div>
  );
}
