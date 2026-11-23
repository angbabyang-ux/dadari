// 시기별 목록: 출생 직후 / 0세 / 1세 / 2~5세 / 입학 전으로 나눠 제도별 금액과 신청처를 보여준다
import type { Benefit } from "../../data/schema";
import type { Excluded, MonthRow } from "../../engine/types";
import { formatWon } from "../../engine/money";
import { CATEGORY_LABEL, groupByPeriod, LEVEL_LABEL } from "./aggregate";
import { Evidence, StatusBadge } from "./parts";

function ymText(ym: string) {
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;
}

export function BenefitList({ rows }: { rows: MonthRow[] }) {
  const periods = groupByPeriod(rows);
  if (periods.length === 0) return <p className="py-8 text-ink-2">이 조건에 맞는 지원금이 없어요. 필터를 바꿔 보세요.</p>;
  return (
    <div>
      {periods.map(({ period, groups, total }) => (
        <section key={period.key} className="pt-8" aria-labelledby={`p-${period.key}`}>
          <div className="flex items-baseline gap-3 pb-2 rule-b border-ink">
            <h2 id={`p-${period.key}`} className="font-serif text-xl font-semibold flex-1">
              {period.title}
            </h2>
            <p className="num font-semibold">{formatWon(total)}</p>
          </div>
          <ul>
            {groups.map((g) => {
              const first = g.items[0]!;
              const auto = g.items.every((i) => i.auto);
              const monthsCount = g.items.length;
              return (
                <li key={g.benefit.id} className="py-4 rule-b grid grid-cols-[1fr_auto] gap-x-4">
                  <div>
                    <p className="font-semibold">{g.benefit.name}</p>
                    <p className="text-sm text-ink-2 flex flex-wrap gap-x-2 gap-y-1 items-center mt-0.5">
                      <StatusBadge status={g.benefit.status} />
                      <span>{CATEGORY_LABEL[g.benefit.category]}</span>
                      <span aria-hidden>·</span>
                      <span className={g.benefit.level !== "national" ? "text-local font-medium" : ""}>{LEVEL_LABEL[g.benefit.level]}</span>
                    </p>
                    <p className="text-sm mt-1">{g.benefit.summary}</p>
                    <p className="text-sm mt-1 text-ink-2">
                      {g.firstMonth === g.lastMonth ? ymText(g.firstMonth) : `${ymText(g.firstMonth)} ~ ${ymText(g.lastMonth)}`}
                      {" · "}
                      {auto ? (
                        "신청 없이 받아요"
                      ) : g.benefit.apply.url ? (
                        <a href={g.benefit.apply.url} target="_blank" rel="noreferrer">
                          {g.benefit.apply.where}
                        </a>
                      ) : (
                        g.benefit.apply.where
                      )}
                      {!auto && g.benefit.apply.deadline ? ` · ${g.benefit.apply.deadline}` : ""}
                    </p>
                    {first.deferred && <p className="text-sm mt-1">{first.deferred}</p>}
                    {first.conditional && <p className="text-sm mt-1">{first.conditional}</p>}
                    {first.mayChange && <p className="text-sm mt-1">{first.mayChange}</p>}
                    <Evidence benefit={g.benefit} formula={first.formula} />
                  </div>
                  <div className="text-right">
                    <p className="num font-semibold">{formatWon(g.total)}</p>
                    {g.monthlyAmount !== undefined && monthsCount > 1 && (
                      <p className="num text-sm text-ink-2">
                        월 {formatWon(g.monthlyAmount)} × {monthsCount}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function InfoCards({ items, title }: { items: Benefit[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <section className="pt-10" aria-labelledby="info-cards">
      <h2 id="info-cards" className="font-serif text-xl font-semibold pb-2 rule-b border-ink">
        {title}
      </h2>
      <p className="text-sm text-ink-2 pt-2">금액이 정해지지 않았거나 서비스형이라 합계에 넣지 않았어요.</p>
      <ul>
        {items.map((b) => (
          <li key={b.id} className="py-3 rule-b">
            <p className="font-semibold">{b.name}</p>
            {b.schedule.type === "info" && b.schedule.amountText && <p className="text-sm num">{b.schedule.amountText}</p>}
            <p className="text-sm text-ink-2 flex flex-wrap gap-x-2 items-center mt-0.5">
              <StatusBadge status={b.status} />
              <span>{LEVEL_LABEL[b.level]}</span>
            </p>
            <p className="text-sm mt-1">{b.summary}</p>
            <Evidence benefit={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ExcludedList({ items, title, open }: { items: Excluded[]; title: string; open?: boolean }) {
  // 같은 제도가 아이마다 여러 번 들어간 경우 하나로
  const unique = [...new Map(items.map((e) => [e.benefit.id, e])).values()];
  if (unique.length === 0) return null;
  return (
    <details className="pt-8" open={open}>
      <summary className="cursor-pointer font-serif text-lg font-semibold pb-2 rule-b">
        {title} <span className="num text-ink-2 font-sans text-base">({unique.length})</span>
      </summary>
      <ul>
        {unique.map((e) => (
          <li key={e.benefit.id} className="py-2 rule-b text-sm grid sm:grid-cols-[14rem_1fr] gap-x-4">
            <span className="font-medium">{e.benefit.name}</span>
            <span className="text-ink-2">{e.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
