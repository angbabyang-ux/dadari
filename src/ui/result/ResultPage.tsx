// 결과 화면: 요약 띠, 달력 리본, 필터, 시기별 목록, 육아휴직 비교, 신청 체크리스트
import { useMemo, useState, type CSSProperties } from "react";
import { benefits, leaveRules, reference, regions } from "../../data";
import { computeTimeline } from "../../engine/timeline";
import { formatWon } from "../../engine/money";
import type { Input, MonthRow } from "../../engine/types";
import { hrefFor, navigate, replaceQuery } from "../../router";
import { draftToParams, scenarioFrom, withDraft } from "../../state/url";
import { FILTERS, filterRows, summarize, type FilterKey } from "./aggregate";
import { BenefitList, ExcludedList, InfoCards } from "./BenefitList";
import { Checklist } from "./Checklist";
import { LeaveTab } from "./LeaveTab";
import { MonthSheet } from "./MonthSheet";
import { CountUp } from "./parts";
import { Ribbon, type Milestone } from "./Ribbon";

const ORDER = ["첫째", "둘째", "셋째", "넷째", "다섯째 이상"];
const TABS = [
  { key: "cal", label: "달력" },
  { key: "leave", label: "육아휴직" },
  { key: "todo", label: "신청할 것" },
] as const;

export function describeInput(input: Input): string {
  const y = input.birthDate.slice(0, 4);
  const m = Number(input.birthDate.slice(5, 7));
  const kids = input.multiples > 1 ? `${["", "", "쌍둥이", "세쌍둥이", "네쌍둥이"][input.multiples]} ` : "";
  return `${y}년 ${m}월${input.expected ? " 출산 예정" : "생"} ${kids}${ORDER[input.birthOrder - 1]} · ${input.sido}${input.sigungu ? ` ${input.sigungu}` : ""}`;
}

export function milestonesFor(input: Input, n: number): Milestone[] {
  const ms: Milestone[] = [];
  for (let a = 12; a < n; a += 12) ms.push({ age: a, label: a === 12 ? "첫돌" : `만 ${a / 12}세` });
  if (input.care.daycareFrom !== undefined) ms.push({ age: input.care.daycareFrom, label: "어린이집" });
  if (input.care.kindergartenFrom !== undefined) ms.push({ age: input.care.kindergartenFrom, label: "유치원" });
  return ms;
}

export function ResultPage({ input, params }: { input: Input; params: URLSearchParams }) {
  const scenario = scenarioFrom(params);
  const filter = (FILTERS.find((f) => f.key === params.get("f"))?.key ?? "all") as FilterKey;
  const includeUnconfirmed = params.get("u") !== "0";
  const tab = (TABS.find((t) => t.key === params.get("t"))?.key ?? "cal") as (typeof TABS)[number]["key"];
  const [selected, setSelected] = useState<number | undefined>();
  const [asTable, setAsTable] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => computeTimeline(input, { benefits, regions, leaveRules, reference }, { scenario }), [input, scenario]);
  const summary = useMemo(() => summarize(result.rows), [result]);
  const shown = useMemo(() => filterRows(result.rows, filter, includeUnconfirmed), [result, filter, includeUnconfirmed]);
  const region = regions.sigungu.find((r) => r.sido === input.sido && r.sigungu === input.sigungu);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const setParam = (k: string, v?: string) => {
    const p = new URLSearchParams(params);
    if (v === undefined) p.delete(k);
    else p.set(k, v);
    replaceQuery(p.toString());
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("이 주소를 복사해 주세요.", window.location.href);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pb-24">
      <p className="pt-4 text-sm text-ink-2">
        참고용 계산이에요. 실제 지급액은 신청 기관의 심사로 정해져요.{" "}
        <a href={hrefFor("data")} onClick={(e) => (e.preventDefault(), navigate("data"))}>
          계산 방법과 출처
        </a>
      </p>

      <header className="pt-4 pb-4 rule-b md:flex md:items-end md:gap-6">
        <div className="flex-1">
          <h1 className="font-serif text-2xl md:text-3xl font-semibold leading-snug">{describeInput(input)}</h1>
          <p className="text-sm text-ink-2 mt-1 num">
            {result.rows[0]!.month.replace("-", ". ")} ~ {result.rows.at(-1)!.month.replace("-", ". ")} · 초등학교 입학 직전까지 {result.rows.length}개월
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 md:mt-0 no-print">
          <a className="btn min-h-10 text-sm" href={hrefFor("home", draftToParams(input))} onClick={(e) => (e.preventDefault(), navigate("home", draftToParams(input)))}>
            입력 고치기
          </a>
          <a className="btn min-h-10 text-sm" href={hrefFor("compare", withDraft(params, input))} onClick={(e) => (e.preventDefault(), navigate("compare", withDraft(params, input)))}>
            다른 동네라면?
          </a>
        </div>
      </header>

      <label className="flex items-start gap-3 py-3 rule-b cursor-pointer no-print">
        <input type="checkbox" className="mt-1.5 w-4 h-4" checked={scenario === "with-proposals"} onChange={(e) => setParam("sc", e.target.checked ? "p" : undefined)} />
        <span>
          <span className="font-semibold">정부안 포함해서 보기</span>
          <span className="block text-sm text-ink-2">2027년 7월 개편안처럼 국회 의결 전인 제도를 빗금 막대로 더해요. 기본은 확정된 제도만 보여줘요.</span>
        </span>
      </label>

      {result.pendingReform && (
        <p className="py-3 rule-b text-sm">
          <strong>2027년 7월 이후 출생이에요.</strong> 지금은 현행 제도(첫만남이용권·부모급여·아동수당)로 계산했어요. 개편 정부안이 국회를 통과하면 아이맞이지원금·아동기본수당으로 바뀌어요. 위의 ‘정부안 포함’을 켜면 바뀐 금액을 볼 수 있어요.
        </p>
      )}
      {region?.cashGrant === "unknown" && (
        <p className="py-3 rule-b text-sm">
          {region.sigungu} 자체 지원은 아직 확인하지 못했어요.{" "}
          <a href={region.homepage} target="_blank" rel="noreferrer">
            {region.sigungu} 누리집
          </a>
          에서 확인해 주세요.
        </p>
      )}
      {region?.cashGrant === "none" && <p className="py-3 rule-b text-sm text-ink-2">{region.sigungu} 자체 현금 출산지원금은 없어요 (2026년 11월 확인). {region.note}</p>}
      {!region && input.sido && regions.sigungu.every((r) => r.sido !== input.sido) && (
        <p className="py-3 rule-b text-sm">
          국가와 시·도 지원만 계산했어요. 시·군·구 지원은{" "}
          <a href="https://www.gov.kr/portal/rcvfvrSvc/main" target="_blank" rel="noreferrer">
            정부24 보조금24
          </a>
          에서 확인해 주세요.
        </p>
      )}

      <SummaryStrip summary={summary} />

      <div role="tablist" aria-label="결과 보기 방식" className="flex gap-6 rule-b mt-8 no-print">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            className={`py-3 -mb-px font-semibold border-b-2 ${tab === t.key ? "border-accent text-ink" : "border-transparent text-ink-2"}`}
            onClick={() => setParam("t", t.key === "cal" ? undefined : t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cal" && (
        <div role="tabpanel">
          <div className="flex gap-2 overflow-x-auto py-4 -mx-4 px-4 md:mx-0 md:px-0 no-print" aria-label="필터">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className="chip" aria-pressed={filter === f.key} onClick={() => setParam("f", f.key === "all" ? undefined : f.key)}>
                {f.label}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={!includeUnconfirmed} onClick={() => setParam("u", includeUnconfirmed ? "0" : undefined)}>
              {includeUnconfirmed ? "미확정 포함" : "미확정 제외"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pb-2">
            <Legend />
            <button type="button" className="text-sm underline underline-offset-4 shrink-0 no-print" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
              {asTable ? "차트로 보기" : "표로 보기"}
            </button>
          </div>
          {asTable ? <MonthTable rows={shown} /> : <Ribbon rows={shown} selected={selected} onSelect={setSelected} currentMonth={currentMonth} milestones={milestonesFor(input, shown.length)} />}

          <BenefitList rows={shown} />
          {result.afterSchool.length > 0 && (
            <p className="pt-4 text-sm text-ink-2">
              분할 지급 중 {formatWon(result.afterSchool.reduce((a, c) => a + c.amount, 0))}은 초등학교 입학 뒤에 들어와서 이 계산에서 뺐어요.
            </p>
          )}
          <InfoCards items={result.info} title="함께 알아둘 혜택" />
          <ExcludedList items={result.excluded} title="이번 조건으로는 받지 못하는 것" />
          <ExcludedList items={result.ended} title="종료된 제도" />
        </div>
      )}
      {tab === "leave" && (
        <div role="tabpanel">
          <LeaveTab input={input} scenario={scenario} />
        </div>
      )}
      {tab === "todo" && (
        <div role="tabpanel">
          <Checklist result={result} input={input} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-10 no-print">
        <button type="button" className="btn" onClick={copy}>
          {copied ? "주소를 복사했어요" : "결과 주소 복사"}
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          인쇄·PDF로 저장
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? "주소를 복사했어요." : ""}
      </p>

      {selected !== undefined && shown[selected] && (
        <MonthSheet
          row={shown[selected]!}
          onClose={() => setSelected(undefined)}
          onPrev={selected > 0 ? () => setSelected(selected - 1) : undefined}
          onNext={selected < shown.length - 1 ? () => setSelected(selected + 1) : undefined}
        />
      )}
    </div>
  );
}

function SummaryStrip({ summary: s }: { summary: ReturnType<typeof summarize> }) {
  const parts = [
    { label: "현금", v: s.cash },
    { label: "바우처", v: s.voucher },
    { label: "지역화폐·상품권", v: s.localCurrency },
    { label: "육아휴직 급여", v: s.leave },
  ];
  const levels = [
    { label: "국가", v: s.national },
    { label: "시·도", v: s.sido },
    { label: "시·군·구", v: s.sigungu },
  ];
  return (
    <section aria-label="요약" className="grid md:grid-cols-12 gap-x-8 pt-6">
      <div className="md:col-span-5 pb-4 md:pb-0">
        <p className="text-sm text-ink-2">입학 전까지 모두</p>
        <p className="font-serif font-bold text-accent text-[40px] md:text-[56px] leading-none mt-1">
          <CountUp value={s.total} />
        </p>
        {s.unconfirmed > 0 && <p className="text-sm text-ink-2 mt-2 num">이 중 {formatWon(s.unconfirmed)}은 확인 필요·정부안이에요.</p>}
      </div>
      <div className="md:col-span-7 rule-t md:border-t-0 md:border-l md:border-rule md:pl-8">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {parts.map((p) => (
            <div key={p.label} className="py-3 pr-2">
              <dt className="text-sm text-ink-2">{p.label}</dt>
              <dd className="num font-semibold text-lg">{formatWon(p.v)}</dd>
            </div>
          ))}
        </dl>
        <dl className="grid grid-cols-3 sm:grid-cols-4 rule-t">
          {levels.map((p) => (
            <div key={p.label} className="py-3 pr-2">
              <dt className="text-sm text-ink-2">{p.label} 몫</dt>
              <dd className={`num font-semibold ${p.label !== "국가" && p.v > 0 ? "text-local" : ""}`}>{formatWon(p.v)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Legend() {
  const sw = (style: CSSProperties) => <span className="inline-block w-3 h-3 align-[-1px] mr-1" style={style} aria-hidden />;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      <li>{sw({ background: "var(--cash)" })}현금</li>
      <li>{sw({ background: "var(--leave)" })}휴직 급여</li>
      <li>{sw({ background: "var(--voucher)" })}바우처</li>
      <li>{sw({ background: "radial-gradient(circle, var(--paper) 30%, var(--voucher) 32%) 0 0/4px 4px" })}지역화폐</li>
      <li>{sw({ background: "repeating-linear-gradient(135deg, var(--ink-2) 0 2px, transparent 2px 4px)" })}확인 필요·정부안</li>
      <li>{sw({ background: "var(--local)", width: 6, height: 6 })}지자체 지원 있는 달</li>
    </ul>
  );
}

function MonthTable({ rows }: { rows: MonthRow[] }) {
  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto rule-t">
      <table className="w-full text-sm num">
        <caption className="sr-only">월별 수령액 표</caption>
        <thead className="sticky top-0 bg-paper">
          <tr className="rule-b text-left text-ink-2">
            <th scope="col" className="py-2 font-medium">달</th>
            <th scope="col" className="py-2 font-medium">생후</th>
            <th scope="col" className="py-2 font-medium text-right">합계</th>
            <th scope="col" className="py-2 font-medium pl-4">내역</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="rule-b align-top">
              <th scope="row" className="py-2 text-left font-normal whitespace-nowrap">{r.month.replace("-", ". ")}</th>
              <td className="py-2 whitespace-nowrap">{r.ageMonths}개월</td>
              <td className="py-2 text-right font-semibold whitespace-nowrap">{formatWon(r.total)}</td>
              <td className="py-2 pl-4 text-ink-2">{r.items.map((i) => `${i.name} ${formatWon(i.amount)}`).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
