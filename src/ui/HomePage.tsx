// 첫 화면: 지원금 계산과 아이랑 가볼만한 곳으로 가는 두 입구, 실제 계산 결과로 그린 작은 미리보기
import { benefits, leaveRules, reference, regions } from "../data";
import { computeTimeline } from "../engine/timeline";
import { formatWon } from "../engine/money";
import { hrefFor, navigate, navigateHref, placesHref } from "../router";
import { draftFromParams } from "../state/url";
import type { Input } from "../engine/types";

// 미리보기 예시: 2026년 12월생 첫째, 서울 강서구, 집에서 키움 (실제 계산 엔진 결과)
const EXAMPLE_Q = "b=2026-12-15&sd=seoul&sg=seoul-gangseo";
const example = computeTimeline(draftFromParams(new URLSearchParams(EXAMPLE_Q)) as Input, { benefits, regions, leaveRules, reference }, { scenario: "current" });
const exampleTotal = example.rows.reduce((a, r) => a + r.total, 0);
const firstTwoYears = example.rows.slice(0, 24);

function Preview() {
  const max = Math.max(...firstTwoYears.map((r) => r.total));
  const W = 24 * 12;
  const H = 96;
  return (
    <figure className="mt-6 border border-rule bg-card px-4 pt-4 pb-3" aria-label="계산 결과 미리보기">
      <figcaption className="flex items-baseline gap-3 text-sm">
        <span className="text-ink-2 flex-1">예시 · 2026년 12월생 첫째, 서울 강서구</span>
        <span className="num font-semibold">입학 전까지 {formatWon(exampleTotal)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full h-24" preserveAspectRatio="none" aria-hidden>
        {firstTwoYears.map((r, i) => {
          const h = Math.max(2, (r.total / max) * (H - 4));
          return <rect key={r.month} x={i * 12 + 1} y={H - h} width={10} height={h} fill="var(--ink)" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-ink-2 num mt-1">
        <span>태어난 달</span>
        <span>첫 2년, 달마다 받는 돈</span>
        <span>생후 23개월</span>
      </div>
    </figure>
  );
}

export function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pb-16">
      <h1 className="font-serif text-[32px] md:text-[48px] leading-[1.2] font-semibold pt-10 md:pt-16 max-w-3xl">아이가 학교에 가기 전까지, 받을 돈과 갈 곳을 한곳에서.</h1>
      <p className="mt-4 text-ink-2 max-w-2xl">출산·육아 지원금을 달마다 계산하고, 서울·경기에서 아이랑 가볼만한 곳을 찾아요. 입력한 내용은 이 브라우저 밖으로 나가지 않아요.</p>

      <div className="grid md:grid-cols-2 gap-x-8 gap-y-10 mt-10 md:mt-14">
        <section aria-labelledby="home-calc" className="rule-t border-ink pt-5">
          <p className="num text-sm text-ink-2">01</p>
          <h2 id="home-calc" className="font-serif text-2xl md:text-3xl font-semibold mt-1">
            지원금 계산
          </h2>
          <p className="mt-2 max-w-md">출생일과 사는 곳만 넣으면 입학 전까지 매달 받는 국가·시도·시군구 지원금과 육아휴직 급여를 달력처럼 보여 줘요.</p>
          <Preview />
          <a className="btn btn-primary mt-6" href={hrefFor("calc")} onClick={(e) => (e.preventDefault(), navigate("calc"))}>
            지원금 계산하기
          </a>
        </section>

        <section aria-labelledby="home-places" className="rule-t border-ink pt-5">
          <p className="num text-sm text-ink-2">02</p>
          <h2 id="home-places" className="font-serif text-2xl md:text-3xl font-semibold mt-1">
            아이랑 가볼만한 곳
          </h2>
          <p className="mt-2 max-w-md">서울 25개 구와 경기 31개 시·군의 키즈카페·도서관·박물관·공원을 실내·무료·연령으로 골라 봐요.</p>
          <ul className="mt-6 rule-t">
            {[
              ["서울", placesHref("seoul"), "25개 구"],
              ["경기", placesHref("gyeonggi"), "31개 시·군"],
              ["아이랑 가볼만한 실내 장소 모음", placesHref("indoor"), "비 오는 날, 더운 날"],
            ].map(([label, href, meta]) => (
              <li key={href} className="rule-b">
                <a href={href} onClick={(e) => (e.preventDefault(), navigateHref(href!))} className="flex items-baseline gap-3 py-4 no-underline group">
                  <span className="flex-1 font-medium group-hover:underline underline-offset-4">{label}</span>
                  <span className="text-sm text-ink-2">{meta}</span>
                  <span aria-hidden className="text-ink-2">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <a className="btn mt-6" href={placesHref()} onClick={(e) => (e.preventDefault(), navigateHref(placesHref()))}>
            장소 찾아보기
          </a>
        </section>
      </div>

      <p className="mt-14 text-sm text-ink-2">
        2027년에는 태어난 날에 따라 받는 지원금이 달라져요.{" "}
        <a href={hrefFor("changes")} onClick={(e) => (e.preventDefault(), navigate("changes"))}>
          무엇이 바뀌는지 보기
        </a>
      </p>
    </div>
  );
}
