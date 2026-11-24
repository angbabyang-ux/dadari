// 2027년에 바뀌는 것: 출생일 슬라이더로 어떤 제도가 적용되는지, 6월 30일생과 7월 1일생을 나란히 보여준다
import { useState } from "react";
import { benefits, leaveRules, reference, regions } from "../data";
import { computeTimeline } from "../engine/timeline";
import { formatWon } from "../engine/money";
import type { Input } from "../engine/types";

const BASE: Input = {
  birthDate: "2027-06-30",
  expected: true,
  birthOrder: 1,
  multiples: 1,
  care: {},
  sido: "서울특별시",
  householdSize: 3,
  homeless: false,
  singleParent: false,
  mother: { employment: "none", wage: 0 },
  father: { employment: "none", wage: 0 },
};
const data = { benefits, regions, leaveRules, reference };
const START = Date.UTC(2026, 9, 1);
const DAYS = 456; // 2026-10-01 ~ 2027-12-31

function dateAt(day: number): string {
  return new Date(START + day * 86400000).toISOString().slice(0, 10);
}

export function ChangesPage() {
  const [day, setDay] = useState(272); // 2027-06-30 근처
  const [order, setOrder] = useState(1);
  const date = dateAt(day);
  const auto = date >= "2027-01-21";
  const reform = date >= "2027-07-01";

  const june = computeTimeline({ ...BASE, birthOrder: order, birthDate: "2027-06-30" }, data, { scenario: "current" });
  const july = computeTimeline({ ...BASE, birthOrder: order, birthDate: "2027-07-01" }, data, { scenario: "with-proposals" });
  const first24 = (r: typeof june) => r.rows.slice(0, 24).map((x) => x.total);
  const sum = (r: typeof june, n: number) => r.rows.slice(0, n).reduce((a, x) => a + x.total, 0);
  const a = first24(june);
  const b = first24(july);
  const max = Math.max(...a, ...b, 1);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pb-24">
      <h1 className="text-2xl md:text-4xl font-bold pt-8 pb-3 rule-b leading-snug">2027년, 태어난 날에 따라 달라지는 것</h1>

      <section className="grid md:grid-cols-12 gap-x-8 pt-6">
        <div className="md:col-span-5">
          <label htmlFor="bday" className="font-semibold block">
            출생(예정)일
          </label>
          <p className="text-3xl font-semibold num mt-1">{date.replace(/-/g, ". ")}</p>
          <input id="bday" type="range" min={0} max={DAYS} value={day} onChange={(e) => setDay(Number(e.target.value))} className="w-full mt-3 accent-[var(--accent)]" aria-valuetext={date} />
          <div className="flex justify-between text-xs text-ink-2 num">
            <span>2026. 10.</span>
            <span>2027. 12.</span>
          </div>
        </div>
        <ol className="md:col-span-7 mt-6 md:mt-0 rule-t">
          <li className="py-3 rule-b">
            <p className="font-semibold">{auto ? "신청하지 않아도 자동으로 받아요." : "출생 후 60일 안에 신청해야 해요."}</p>
            <p className="text-sm text-ink-2">2027년 1월 21일 이후 출생아부터 아동수당·부모급여·첫만남이용권을 신청 없이 줘요. 개정 법률은 확정됐어요.</p>
          </li>
          <li className="py-3 rule-b">
            <p className="font-semibold">{reform ? "아이맞이지원금 + 아동기본수당 (정부안)" : "첫만남이용권 + 부모급여 + 아동수당 (현행)"}</p>
            <p className="text-sm text-ink-2">
              {reform
                ? "2027년 7월 1일 이후 출생아에게 적용하려는 정부안이에요. 국회 예산 의결과 아동수당법 개정이 필요해서 아직 확정되지 않았어요. 통과되지 않으면 현행 제도가 이어져요."
                : "2027년 6월 30일까지 태어난 아이는 지금 제도를 그대로 받아요."}
            </p>
          </li>
        </ol>
      </section>

      <section className="pt-12">
        <div className="flex flex-wrap items-center gap-4 pb-3">
          <h2 className="text-lg font-bold flex-1">하루 차이, 첫 2년 동안 받는 돈</h2>
          <div className="seg flex flex-wrap" role="radiogroup" aria-label="출생순위">
            {[1, 2, 3].map((o) => (
              <label key={o}>
                <input type="radio" name="order" checked={order === o} onChange={() => setOrder(o)} />
                {["첫째", "둘째", "셋째 이상"][o - 1]}
              </label>
            ))}
          </div>
        </div>
        <p className="text-sm text-ink-2 pt-2">서울(기본지역), 출산 예정, 집에서 키우는 경우예요. 서울시 지원은 넣고 시·군·구 지원과 육아휴직 급여는 뺐어요.</p>

        <div className="grid md:grid-cols-2 gap-3 pt-4">
          {[
            { title: "2027년 6월 30일생 · 현행", rows: a, total: sum(june, 24), note: "부모급여 + 아동수당 매달, 첫만남이용권 한 번", draft: false },
            { title: "2027년 7월 1일생 · 정부안", rows: b, total: sum(july, 24), note: "아동기본수당 매달, 아이맞이지원금 3개월마다", draft: true },
          ].map((c) => (
            <div key={c.title} className="card border-rule p-4">
              <p className="font-semibold text-sm">
                {c.title} {c.draft && <span className="badge badge-accent badge-proposed">정부안</span>}
              </p>
              <p className="text-[28px] font-bold num mt-1 text-amount">{formatWon(c.total)}</p>
              <p className="text-sm text-ink-2">{c.note}</p>
              <svg viewBox={`0 0 ${24 * 14} 120`} width="100%" height="120" preserveAspectRatio="none" role="img" aria-label={`${c.title} 첫 24개월 월별 금액: ${c.rows.map(formatWon).join(", ")}`} className="mt-3">
                <defs>
                  <pattern id={`h${c.draft}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="5" height="5" fill="var(--cash)" />
                    <line x1="0" y1="0" x2="0" y2="5" stroke="var(--paper)" strokeWidth="2" />
                  </pattern>
                </defs>
                {c.rows.map((v, i) => {
                  const h = (v / max) * 112;
                  return <rect key={i} x={i * 14 + 2} y={120 - h} width={10} height={h} fill={c.draft ? `url(#h${c.draft})` : "var(--cash)"} />;
                })}
              </svg>
              <div className="flex justify-between text-xs text-ink-2 num">
                <span>출생월</span>
                <span>생후 23개월</span>
              </div>
            </div>
          ))}
        </div>
        <p className="pt-6 text-sm num">
          첫 12개월만 보면 6월 30일생 {formatWon(sum(june, 12))}, 7월 1일생 {formatWon(sum(july, 12))}이에요. 아동기본수당은 만 12세까지 이어져서 입학 전까지 합계는{" "}
          {formatWon(june.rows.reduce((x, r) => x + r.total, 0))}와 {formatWon(july.rows.reduce((x, r) => x + r.total, 0))}예요.
        </p>
      </section>
    </div>
  );
}
