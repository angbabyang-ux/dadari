// 시기별 목록: 출생 직후 / 0세 / 1세 / 2~5세 / 입학 전. 카드를 누르면 "이렇게 써요"가 펼쳐진다
import { useId, useState } from "react";
import type { Benefit, Usage } from "../../data/schema";
import type { Excluded, MonthRow } from "../../engine/types";
import { formatWon } from "../../engine/money";
import { CATEGORY_LABEL, groupByPeriod, LEVEL_LABEL, type BenefitGroup } from "./aggregate";
import { Evidence, StatusBadge } from "./parts";
import { dDay, expiryDate } from "./usage";

function ymText(ym: string) {
  return `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;
}
function ymdText(s: string) {
  return `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`;
}

export function BenefitList({ rows, birthDate, today }: { rows: MonthRow[]; birthDate: string; today: string }) {
  const periods = groupByPeriod(rows);
  if (periods.length === 0) return <p className="py-8 text-ink-2">이 조건에 맞는 지원금이 없어요. 필터를 바꿔 보세요.</p>;
  return (
    <div>
      {periods.map(({ period, groups, total }) => (
        <section key={period.key} className="pt-8" aria-labelledby={`p-${period.key}`}>
          <div className="flex items-baseline gap-3 pb-2 rule-b border-ink">
            <h3 id={`p-${period.key}`} className="font-serif text-xl font-semibold flex-1">
              {period.title}
            </h3>
            <p className="num font-semibold">{formatWon(total)}</p>
          </div>
          <ul>
            {groups.map((g) => (
              <BenefitCard key={g.benefit.id} g={g} birthDate={birthDate} today={today} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BenefitCard({ g, birthDate, today }: { g: BenefitGroup; birthDate: string; today: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const first = g.items[0]!;
  const auto = g.items.every((i) => i.auto);
  const b = g.benefit;
  const head = (
    <>
      <span className="flex items-baseline gap-3">
        <span className="font-semibold flex-1">{b.name}</span>
        <span className="num font-semibold">{formatWon(g.total)}</span>
      </span>
      {g.monthlyAmount !== undefined && g.months > 1 && (
        <span className="block num text-sm text-ink-2 text-right">
          월 {formatWon(g.monthlyAmount)} × {g.months}
        </span>
      )}
    </>
  );
  return (
    <li className="py-3 rule-b">
      {b.usage ? (
        <button type="button" className="w-full text-left min-h-11 block" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          {head}
          <span className="block text-sm underline underline-offset-4 decoration-rule mt-1">{open ? "접기" : "이렇게 써요"}</span>
        </button>
      ) : (
        <div>{head}</div>
      )}

      <p className="text-sm text-ink-2 flex flex-wrap gap-x-2 gap-y-1 items-center mt-1">
        <StatusBadge status={b.status} />
        <span>{CATEGORY_LABEL[b.category]}</span>
        <span aria-hidden>·</span>
        <span className={b.level !== "national" ? "text-local font-medium" : ""}>{LEVEL_LABEL[b.level]}</span>
      </p>
      <p className="text-sm mt-1">{b.summary}</p>
      <p className="text-sm mt-1 num">{g.firstMonth === g.lastMonth ? ymText(g.firstMonth) : `${ymText(g.firstMonth)} ~ ${ymText(g.lastMonth)}`}</p>
      <p className="text-sm">
        {auto ? (
          "신청 없이 받아요."
        ) : b.apply.url ? (
          <a href={b.apply.url} target="_blank" rel="noreferrer" className="inline-block py-1">
            {b.apply.where}
          </a>
        ) : (
          b.apply.where
        )}
      </p>
      {!auto && b.apply.deadline && <p className="text-sm">{b.apply.deadline}</p>}
      {first.deferred && <p className="text-sm mt-1">{first.deferred}</p>}
      {first.conditional && <p className="text-sm mt-1">{first.conditional}</p>}
      {first.mayChange && <p className="text-sm mt-1">{first.mayChange}</p>}

      {b.usage && (
        <div className="unfold" data-open={open} id={panelId} role="region" aria-label={`${b.name} 이렇게 써요`}>
          <div inert={!open} aria-hidden={!open}>
            <UsagePanel usage={b.usage} birthDate={birthDate} today={today} />
          </div>
        </div>
      )}
      <Evidence benefit={b} formula={first.formula} />
    </li>
  );
}

const NEED = <span className="badge text-ink border-dashed">확인 필요</span>;

function UsagePanel({ usage: u, birthDate, today }: { usage: Usage; birthDate: string; today: string }) {
  const unverified = (k: string) => u.unverified?.some((x) => x.includes(k));
  const exp = expiryDate(u, birthDate);
  return (
    <div className="mt-3 border border-rule bg-card px-4 py-3 text-sm space-y-3">
      <div>
        <h4 className="font-semibold">받는 방법</h4>
        <p>{unverified("받는 방법") ? <>{u.receive} {NEED}</> : u.receive}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <h4 className="font-semibold">쓸 수 있는 곳</h4>
          {u.allowed.length ? (
            <ul className="list-disc pl-5">
              {u.allowed.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            NEED
          )}
        </div>
        <div>
          <h4 className="font-semibold">쓸 수 없는 곳</h4>
          {u.notAllowed.length ? (
            <ul className="list-disc pl-5">
              {u.notAllowed.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : unverified("쓸 수 없는 곳") ? (
            NEED
          ) : (
            <p>따로 정해진 곳이 없어요.</p>
          )}
        </div>
      </div>
      <div>
        <h4 className="font-semibold">사용 기한</h4>
        {exp ? (
          <p className="num">
            {ymdText(exp)}까지 <strong>{dDay(exp, today)}</strong>
          </p>
        ) : u.noExpiry ? (
          <p>현금이라 기한이 없어요.</p>
        ) : (
          <p>{NEED}</p>
        )}
      </div>
      {u.tips.length > 0 && (
        <div>
          <h4 className="font-semibold">놓치기 쉬운 점</h4>
          <ul className="list-disc pl-5">
            {u.tips.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-ink-2">
        <p className="num">마지막 확인 {u.lastVerified}</p>
        <ul>
          {u.sourceUrl.map((s) => (
            <li key={s}>
              <a href={s} target="_blank" rel="noreferrer" className="inline-block py-1">
                공식 안내 · {new URL(s).hostname.replace(/^www\./, "")}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function InfoCards({ items, title }: { items: Benefit[]; title: string }) {
  if (items.length === 0) return null;
  return (
    <section className="pt-10" aria-labelledby="info-cards">
      <h3 id="info-cards" className="font-serif text-xl font-semibold pb-2 rule-b border-ink">
        {title}
      </h3>
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
  const unique = [...new Map(items.map((e) => [e.benefit.id, e])).values()];
  if (unique.length === 0) return null;
  return (
    <details className="pt-8" open={open}>
      <summary className="cursor-pointer font-serif text-lg font-semibold pb-2 rule-b min-h-11">
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
