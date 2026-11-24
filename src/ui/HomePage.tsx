// 첫 화면: 지원금 계산과 아이랑 가볼만한 곳으로 가는 두 입구, 실제 계산 결과로 만든 예시 결과 카드
import { benefits, leaveRules, reference, regions } from "../data";
import { computeTimeline } from "../engine/timeline";
import { formatWon } from "../engine/money";
import { hrefFor, navigate, navigateHref, placesHref } from "../router";
import { draftFromParams } from "../state/url";
import type { Input } from "../engine/types";
import { summarize } from "./result/aggregate";

// 예시: 2026년 12월생 첫째, 서울 강서구, 집에서 키움 (실제 계산 엔진 결과)
const EXAMPLE_Q = "b=2026-12-15&sd=seoul&sg=seoul-gangseo";
const example = computeTimeline(draftFromParams(new URLSearchParams(EXAMPLE_Q)) as Input, { benefits, regions, leaveRules, reference }, { scenario: "current" });
const sum = summarize(example.rows);
const firstTwoYears = example.rows.slice(0, 24);
const firstYear = example.rows.slice(0, 12).reduce((a, r) => a + r.total, 0);

function Bars() {
  const max = Math.max(...firstTwoYears.map((r) => r.total));
  const H = 64;
  return (
    <svg viewBox={`0 0 ${24 * 12} ${H}`} className="w-full h-16" preserveAspectRatio="none" aria-hidden>
      {firstTwoYears.map((r, i) => {
        const h = Math.max(2, (r.total / max) * (H - 2));
        return <rect key={r.month} x={i * 12 + 1} y={H - h} width={10} height={h} rx={2} fill="var(--cash)" />;
      })}
    </svg>
  );
}

function EntryCard({ href, title, desc, onGo }: { href: string; title: string; desc: string; onGo: () => void }) {
  return (
    <a href={href} onClick={(e) => (e.preventDefault(), onGo())} className="block rounded-ctl border-2 border-rule bg-card p-4 no-underline transition-colors hover:border-accent hover:bg-accent-bg">
      <span className="block font-semibold">{title}</span>
      <span className="block mt-1 text-sm text-ink-3">{desc}</span>
    </a>
  );
}

export function HomePage() {
  const go = (r: "calc" | "changes") => navigate(r);
  return (
    <>
      <section className="px-4 py-12 md:py-20">
        <div className="mx-auto max-w-[640px]">
          <div className="text-center">
            <h1 className="text-2xl md:text-[30px] md:leading-9 font-bold">출산·육아 지원금 계산과 아이랑 가볼만한 곳</h1>
            <p className="mt-2 text-ink-2">아이가 학교에 가기 전까지 받을 돈과 갈 곳을 한곳에서 찾아요.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-8 md:mt-11">
            <EntryCard href={hrefFor("calc")} onGo={() => go("calc")} title="지원금 계산" desc="입학 전까지 매달 받는 지원금과 육아휴직 급여" />
            <EntryCard href={placesHref()} onGo={() => navigateHref(placesHref())} title="아이랑 가볼만한 곳" desc="서울 25개 구·경기 31개 시·군의 키즈카페·도서관·박물관·공원" />
          </div>
          <a className="btn btn-primary w-full mt-6" href={hrefFor("calc")} onClick={(e) => (e.preventDefault(), go("calc"))}>
            지원금 계산하기
          </a>
          <p className="mt-4 text-center text-sm text-ink-label">
            2027년에는 태어난 날에 따라 받는 지원금이 달라져요.{" "}
            <a href={hrefFor("changes")} onClick={(e) => (e.preventDefault(), go("changes"))} className="text-accent no-underline font-medium">
              무엇이 바뀌는지 보기
            </a>
          </p>
        </div>
      </section>

      {/* 예시 결과: 레퍼런스의 결과 띠·결과 카드 형식 */}
      <section className="band px-4 py-8" aria-labelledby="example-title">
        <div className="mx-auto max-w-[864px]">
          <h2 id="example-title" className="text-lg font-bold">
            예시 결과
          </h2>
          <div className="card mt-4 p-4 md:p-5">
            <div className="grid md:grid-cols-[12rem_1fr_auto] gap-4 md:gap-0 md:items-center">
              <div className="flex md:block justify-between items-start gap-3">
                <div>
                  <p className="text-sm font-semibold">2026년 12월생 첫째</p>
                  <p className="text-xs text-ink-3 mt-0.5">서울 강서구 · 집에서 키움</p>
                </div>
                <div className="md:hidden text-right">
                  <span className="stat-label">입학 전까지 모두</span>
                  <span className="block num text-xl font-bold text-amount">{formatWon(sum.total)}</span>
                </div>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 md:border-x md:border-rule-soft md:px-4">
                <div>
                  <dt className="stat-label">현금</dt>
                  <dd className="stat-value">{formatWon(sum.cash)}</dd>
                </div>
                <div>
                  <dt className="stat-label">바우처</dt>
                  <dd className="stat-value">{formatWon(sum.voucher)}</dd>
                </div>
                <div>
                  <dt className="stat-label">첫 1년</dt>
                  <dd className="stat-value">{formatWon(firstYear)}</dd>
                </div>
                <div>
                  <dt className="stat-label">받는 기간</dt>
                  <dd className="stat-value">{example.rows.length}개월</dd>
                </div>
              </dl>
              <div className="hidden md:block text-right pl-4">
                <span className="stat-label">입학 전까지 모두</span>
                <span className="block num text-xl font-bold text-amount">{formatWon(sum.total)}</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-rule-soft">
              <Bars />
              <div className="flex justify-between text-xs text-ink-3 num mt-1">
                <span>태어난 달</span>
                <span>첫 2년, 달마다 받는 돈</span>
                <span>생후 23개월</span>
              </div>
            </div>
            <div className="mt-3 text-right">
              <a className="btn btn-primary btn-sm" href={hrefFor("result", EXAMPLE_Q)} onClick={(e) => (e.preventDefault(), navigate("result", EXAMPLE_Q))}>
                이 예시 자세히 보기
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
