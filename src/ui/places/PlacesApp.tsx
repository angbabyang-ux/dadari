// 아이랑 가볼만한 곳 화면들: 첫 화면, 시·도(추천+지역 칩), 지역(필터·목록/지도), 실내 모음. 첫 화면 묶음과 따로 불러온다
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { picks } from "../../data/places-index.json";
import type { AgeBand, Place } from "../../data/schema";
import { hrefFor, navigateHref, placesHref, placesPathOf, replaceQuery, type PlacesPath } from "../../router";
import { AGE_BANDS, AGE_LABEL, EMPTY_FILTER, filterFromParams, filterPlaces, filterToParams, isEmptyFilter, sortIndoor, type PlaceFilter } from "../../places/filter";
import { placesSeo, regionCount } from "../../places/seo";
import {
  loadRegions,
  placeRegions,
  placesOf,
  regionBySlug,
  regionsOfSido,
  SIDO_IDS,
  SIDO_SHORT,
  sidoOfRegion,
  slugOf,
  useStoreVersion,
  type SidoId,
} from "../../places/store";
import { PlaceCard } from "./PlaceCard";

/** 이 화면을 그리기 전에 불러와야 할 지역 파일들 */
export function regionsNeeded(pathname: string, params: URLSearchParams): string[] {
  const pp = placesPathOf(pathname);
  if (pp.kind === "region") {
    const r = regionBySlug(pp.sido, pp.slug);
    return r ? [r.id] : [];
  }
  if (pp.kind === "indoor") {
    const sd = params.get("sd") === "gyeonggi" ? "gyeonggi" : "seoul";
    const sg = params.get("sg");
    const rs = regionsOfSido(sd);
    return sg && rs.some((r) => r.id === sg) ? [sg] : rs.map((r) => r.id);
  }
  return [];
}

function Link({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={className} onClick={(e) => (e.metaKey || e.ctrlKey ? undefined : (e.preventDefault(), navigateHref(href)))}>
      {children}
    </a>
  );
}

function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="위치" className="pt-6 text-sm text-ink-2">
      <ol className="flex flex-wrap gap-x-2">
        {items.map(([label, href], i) => (
          <li key={label} className="flex items-center gap-x-2">
            {i > 0 && <span aria-hidden>›</span>}
            {href ? (
              <Link href={href} className="inline-flex items-center min-h-11">
                {label}
              </Link>
            ) : (
              <span aria-current="page" className="inline-flex items-center min-h-11 text-ink">
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const isSido = (s: string): s is SidoId => (SIDO_IDS as readonly string[]).includes(s);

export function PlacesApp({ pathname, params }: { pathname: string; params: URLSearchParams }) {
  const pp = placesPathOf(pathname);
  const query = params.toString();
  // 화면 이동 때 탭 제목도 바꾼다 (첫 진입은 미리 그린 HTML의 제목과 같다)
  useEffect(() => {
    document.title = placesSeo(pp).title;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const needed = useMemo(() => regionsNeeded(pathname, new URLSearchParams(query)), [pathname, query]);
  useStoreVersion();
  const ready = needed.every((id) => placesOf(id));
  useEffect(() => {
    if (!ready) void loadRegions(needed);
  }, [ready, needed]);

  let body: ReactNode;
  if (pp.kind === "home") body = <PlacesHome />;
  else if (pp.kind === "indoor") body = <IndoorPage params={params} ready={ready} />;
  else if (pp.kind === "sido" && isSido(pp.sido)) body = <SidoPage sido={pp.sido} />;
  else if (pp.kind === "region" && isSido(pp.sido) && regionBySlug(pp.sido, pp.slug))
    body = ready ? <RegionPage pp={pp} params={params} /> : <Loading />;
  else body = <NotFound />;
  return <div className="mx-auto max-w-6xl px-4 md:px-8 pb-24">{body}</div>;
}

function Loading() {
  return <p className="py-16 text-ink-2">장소를 불러오고 있어요.</p>;
}
function NotFound() {
  return (
    <div className="py-16">
      <h1 className="text-2xl font-bold">찾는 지역이 없어요.</h1>
      <p className="mt-2">
        <Link href={placesHref()}>아이랑 가볼만한 곳 처음으로</Link>
      </p>
    </div>
  );
}

const SIDO_UNIT: Record<SidoId, string> = { seoul: "개 구", gyeonggi: "개 시·군" };

function PlacesHome() {
  return (
    <>
      <h1 className="text-3xl md:text-5xl font-bold pt-10 pb-3 rule-b">아이랑 가볼만한 곳</h1>
      <p className="pt-4 max-w-2xl min-h-[5.5rem] md:min-h-0">서울 25개 구와 경기 31개 시·군에서 아이와 갈 만한 키즈카페·도서관·박물관·공원을 공공데이터로 모았어요.</p>
      {/* 시·도는 세로로 크게, 실내 모음은 그보다 한 단계 작게 */}
      <ul className="mt-8 space-y-3">
        {SIDO_IDS.map((s) => {
          const rs = regionsOfSido(s);
          const c = rs.reduce((a, r) => { const x = regionCount(r.id); return { total: a.total + x.total, indoor: a.indoor + x.indoor, free: a.free + x.free }; }, { total: 0, indoor: 0, free: 0 });
          return (
            <li key={s}>
              <Link href={placesHref(s)} className="grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-ctl border-2 border-rule bg-card px-5 py-5 no-underline group hover:border-accent hover:bg-accent-bg transition-colors">
                <span>
                  <span className="block text-2xl md:text-[30px] md:leading-9 font-bold">{SIDO_SHORT[s]}</span>
                  <span className="block mt-2 text-sm text-ink-2 num">
                    {rs.length}
                    {SIDO_UNIT[s]} · {c.total}곳 · 실내 {c.indoor}곳 · 무료 {c.free}곳
                  </span>
                  <span className="block mt-1 text-sm text-ink-2 truncate max-w-[calc(100vw-6rem)] md:max-w-3xl">{rs.map((r) => r.sigungu).join(" · ")}</span>
                </span>
                <span aria-hidden className="text-xl text-ink-3 group-hover:text-accent transition-colors">
                  →
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href={placesHref("indoor")} className="grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-ctl border-2 border-rule bg-card px-5 py-4 no-underline group hover:border-accent hover:bg-accent-bg transition-colors">
            <span>
              <span className="block text-base font-semibold">아이랑 가볼만한 실내 장소 모음</span>
              <span className="block mt-1 text-sm text-ink-2">비 오는 날, 눈 오는 날, 너무 더운 날에 좋아요. 무료 공공시설을 먼저 보여 줘요.</span>
            </span>
            <span aria-hidden className="text-lg text-ink-3 group-hover:text-accent transition-colors">
              →
            </span>
          </Link>
        </li>
      </ul>
      <DataNote />
    </>
  );
}

function DataNote() {
  return (
    <p className="mt-10 text-sm text-ink-2 max-w-2xl">
      공공데이터의 기준일 정보예요. 운영 시간과 요금은 바뀔 수 있으니 가기 전에 시설에 확인해 주세요. 블로그 후기 같은 비공식 정보는 쓰지 않아요.{" "}
      <a href={`${hrefFor("data")}#places`}>출처 보기</a>
    </p>
  );
}

function SidoPage({ sido }: { sido: SidoId }) {
  const rs = regionsOfSido(sido);
  const short = SIDO_SHORT[sido];
  const recs = (picks as unknown as Record<SidoId, Place[]>)[sido];
  return (
    <>
      <Crumbs items={[["아이랑 가볼만한 곳", placesHref()], [short]]} />
      <h1 className="text-3xl md:text-4xl font-bold pb-3 rule-b">{short}에서 아이랑 가볼만한 곳</h1>
      <section aria-labelledby="pick-region" className="pt-6">
        <h2 id="pick-region" className="font-semibold">
          {sido === "seoul" ? "구" : "시·군"}를 골라 주세요.
        </h2>
        {/* 칸 수를 고정해 웹폰트가 늦게 바뀌어도 줄 수가 달라지지 않게 한다 */}
        <ul className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 pt-3">
          {rs.map((r) => (
            <li key={r.id}>
              <Link href={placesHref(`${sido}/${slugOf(r.id)}`)} className="chip no-underline w-full justify-between">
                {r.sigungu}
                <span className="num text-ink-2">{regionCount(r.id).total}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="recs" className="pt-10">
        <h2 id="recs" className="text-lg font-bold pb-3">
          무료 실내 공공시설부터
        </h2>
        <p className="text-sm text-ink-2 pt-2">무료로 확인된 키즈카페·어린이도서관을 지역마다 한 곳씩 골랐어요.</p>
        <ul className="space-y-3">
          {recs.map((p) => (
            <PlaceCard key={p.id} p={p} regionLabel={placeRegions.find((r) => r.id === p.sigungu)?.sigungu} />
          ))}
        </ul>
      </section>
      <Link href={placesHref("indoor", `sd=${sido}`)} className="btn mt-8">
        {short} 실내 장소 모두 보기
      </Link>
      <DataNote />
    </>
  );
}

function FilterBar({ f, onChange }: { f: PlaceFilter; onChange: (f: PlaceFilter) => void }) {
  const t = (k: keyof PlaceFilter, label: string) => (
    <button type="button" className="chip" aria-pressed={!!f[k]} onClick={() => onChange({ ...f, [k]: !f[k] })}>
      {label}
    </button>
  );
  return (
    <div className="pt-6 space-y-3" role="group" aria-label="장소 거르기">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={isEmptyFilter(f)} onClick={() => onChange(EMPTY_FILTER)}>
          전체
        </button>
        {t("indoor", "실내만")}
        {t("free", "무료만")}
        {t("nursing", "수유실 있음")}
        {t("stroller", "유모차 가능")}
        {t("noReservation", "예약 필요 없음")}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="age-label">
        <span id="age-label" className="text-sm text-ink-2 mr-1">
          우리 아이 나이
        </span>
        {AGE_BANDS.map((a: AgeBand) => (
          <button key={a} type="button" className="chip" aria-pressed={f.age === a} onClick={() => onChange({ ...f, age: f.age === a ? null : a })}>
            {AGE_LABEL[a]}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyResult({ f }: { f: PlaceFilter }) {
  const sparse = f.age || f.nursing || f.stroller;
  return (
    <p className="py-8 text-ink-2">
      조건에 맞는 곳이 없어요.
      {sparse ? " 이용 연령·수유실·유모차 정보는 공공데이터에 거의 없어서 확인된 곳만 보여 줘요." : " 다른 조건을 골라 보세요."}
    </p>
  );
}

type MapComp = ComponentType<{ places: Place[]; onPick: (id: string) => void }>;

function RegionPage({ pp, params }: { pp: Extract<PlacesPath, { kind: "region" }>; params: URLSearchParams }) {
  const r = regionBySlug(pp.sido, pp.slug)!;
  const sido = sidoOfRegion(r.id);
  const all = placesOf(r.id) ?? [];
  const f = filterFromParams(params);
  const list = filterPlaces(all, f);
  const view = params.get("view") === "map" ? "map" : "list";
  const c = regionCount(r.id);
  const [MapC, setMapC] = useState<MapComp | null>(null);
  useEffect(() => {
    if (view === "map" && !MapC) void import("./MapView").then((m) => setMapC(() => m.default));
  }, [view, MapC]);
  const setParams = (p: URLSearchParams) => replaceQuery(p.toString());
  const pick = useCallback((id: string) => {
    const p = new URLSearchParams(window.location.search);
    p.delete("view");
    replaceQuery(p.toString());
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  }, []);

  return (
    <>
      <Crumbs items={[["아이랑 가볼만한 곳", placesHref()], [SIDO_SHORT[sido], placesHref(sido)], [r.sigungu]]} />
      <h1 className="text-3xl md:text-4xl font-bold pb-3 rule-b">{r.sigungu}에서 아이랑 가볼만한 곳</h1>
      <p className="pt-3 text-sm text-ink-2 num">
        {c.total}곳 · 실내 {c.indoor}곳 · 무료 {c.free}곳
      </p>
      <FilterBar f={f} onChange={(nf) => setParams(filterToParams(nf, params))} />
      <div className="flex items-center gap-3 pt-6 pb-3">
        <p className="flex-1 font-semibold num" aria-live="polite">
          {list.length}곳
        </p>
        <div className="seg flex" role="radiogroup" aria-label="보기 방식">
          {(["list", "map"] as const).map((v) => (
            <label key={v}>
              <input
                type="radio"
                name="view"
                checked={view === v}
                onChange={() => {
                  const p = new URLSearchParams(params);
                  if (v === "map") p.set("view", "map");
                  else p.delete("view");
                  setParams(p);
                }}
              />
              {v === "list" ? "목록" : "지도"}
            </label>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyResult f={f} />
      ) : view === "map" ? (
        <div className="pt-4">{MapC ? <MapC places={list} onPick={pick} /> : <div className="h-[60vh] min-h-80 border border-rule grid place-items-center text-ink-2">지도를 불러오고 있어요.</div>}</div>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <PlaceCard key={p.id} p={p} />
          ))}
        </ul>
      )}
      <section className="mt-12 rule-t pt-6">
        <a href={hrefFor("home").replace(/\/$/, "") + `/r/${r.id}/`} className="btn">
          {r.sigungu} 출산·육아 지원금 계산하기
        </a>
      </section>
      <DataNote />
    </>
  );
}

const PAGE = 30;
function IndoorPage({ params, ready }: { params: URLSearchParams; ready: boolean }) {
  const sd: SidoId = params.get("sd") === "gyeonggi" ? "gyeonggi" : "seoul";
  const rs = regionsOfSido(sd);
  const sg = rs.some((r) => r.id === params.get("sg")) ? params.get("sg")! : "";
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [sd, sg]);
  const ids = sg ? [sg] : rs.map((r) => r.id);
  const list = ready ? sortIndoor(ids.flatMap((id) => (placesOf(id) ?? []).filter((p) => p.setting !== "outdoor"))) : [];
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    if (k === "sd") p.delete("sg");
    replaceQuery(p.toString());
  };
  const nameOf = (id: string) => placeRegions.find((r) => r.id === id)?.sigungu;
  return (
    <>
      <Crumbs items={[["아이랑 가볼만한 곳", placesHref()], ["실내 장소 모음"]]} />
      <h1 className="text-3xl md:text-4xl font-bold pb-3 rule-b leading-tight">아이랑 가볼만한 실내 장소 모음</h1>
      <p className="pt-4 max-w-2xl">비 오는 날, 눈 오는 날, 너무 더운 날에 갈 만한 곳이에요. 무료로 확인된 공공시설을 먼저 보여 줘요.</p>
      <div className="grid sm:grid-cols-2 gap-4 pt-6 max-w-2xl">
        <div className="seg grid grid-cols-2" role="radiogroup" aria-label="시·도">
          {SIDO_IDS.map((s) => (
            <label key={s}>
              <input type="radio" name="sd" checked={sd === s} onChange={() => set("sd", s === "seoul" ? "" : s)} />
              {SIDO_SHORT[s]}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">시·군·구</span>
          <select className="field" value={sg} onChange={(e) => set("sg", e.target.value)}>
            <option value="">{SIDO_SHORT[sd]} 전체</option>
            {rs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.sigungu}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="pt-6 pb-3 font-bold num" aria-live="polite">
        {ready ? `${list.length}곳` : "불러오는 중"}
      </p>
      {!ready ? (
        <Loading />
      ) : (
        <>
          <ul className="space-y-3">
            {list.slice(0, shown).map((p) => (
              <PlaceCard key={p.id} p={p} regionLabel={sg ? undefined : nameOf(p.sigungu)} />
            ))}
          </ul>
          {shown < list.length && (
            <button type="button" className="btn mt-6" onClick={() => setShown(shown + PAGE)}>
              {Math.min(PAGE, list.length - shown)}곳 더 보기
            </button>
          )}
        </>
      )}
      {sg && (
        <p className="mt-8">
          <Link href={placesHref(`${sd}/${slugOf(sg)}`)}>{nameOf(sg)}의 야외 장소까지 모두 보기</Link>
        </p>
      )}
      <DataNote />
    </>
  );
}
