// 장소 카드: 이름·한 줄 소개·실내/야외·연령·요금·주소를 보여 주고, 누르면 운영 정보와 출처가 펼쳐진다
import { useId, useState } from "react";
import type { Place } from "../../data/schema";
import { AGE_LABEL } from "../../places/filter";
import { kakaoMapHref, naverMapHref, reportHref } from "../../places/links";

export const SETTING_LABEL: Record<Place["setting"], string> = { indoor: "실내", outdoor: "야외", mixed: "실내외" };
export const CATEGORY_LABEL: Record<Place["category"], string> = { kidscafe: "키즈카페", library: "도서관", museum: "박물관·미술관", park: "공원" };

function feeText(p: Place) {
  if (p.fee.free === true) return p.fee.text && p.fee.text !== "무료" && !p.fee.text.startsWith("무료 (") ? p.fee.text : "무료";
  return p.fee.text ?? "안내 없음";
}
function agesText(p: Place) {
  return p.ages ? p.ages.map((a) => AGE_LABEL[a]).join(" · ") : "안내 없음";
}

export function PlaceCard({ p, regionLabel }: { p: Place; regionLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const panelId = useId();
  return (
    <li className="card border-rule p-4" id={p.id}>
      <button type="button" className="w-full text-left block min-h-11" aria-expanded={open} aria-controls={panelId} onClick={() => (setOpen(!open), setEverOpened(true))}>
        {/* 레퍼런스 결과 카드: 왼쪽 이름·설명 | 오른쪽 수치 칸(연령·요금) */}
        <span className="grid sm:grid-cols-[1fr_13rem] gap-x-6 gap-y-3">
          <span className="block">
            <span className="block font-semibold leading-snug">{p.name}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
              <span className="badge">{SETTING_LABEL[p.setting]}</span>
              {p.fee.free === true && <span className="badge badge-best">무료</span>}
              <span>{CATEGORY_LABEL[p.category]}</span>
              {regionLabel && (
                <>
                  <span aria-hidden>·</span>
                  <span>{regionLabel}</span>
                </>
              )}
            </span>
            <span className="block text-sm text-ink-2 mt-2">{p.summary}</span>
            <span className="block text-xs text-ink-3 mt-1">{p.address}</span>
          </span>
          <span className="grid grid-cols-2 sm:grid-cols-1 content-start gap-x-4 gap-y-2 sm:border-l sm:border-rule-soft sm:pl-6">
            <span className="block">
              <span className="stat-label">연령</span>
              <span className="stat-value">{agesText(p)}</span>
            </span>
            <span className="block">
              <span className="stat-label">요금</span>
              <span className="stat-value">{feeText(p)}</span>
            </span>
          </span>
        </span>
        <span className="block text-sm text-accent font-medium mt-3">{open ? "접기" : "운영 정보 보기"}</span>
      </button>
      <p className="text-xs text-ink-3 flex flex-wrap gap-x-3 items-center">
        <span className="num">마지막 확인 {p.lastVerified}</span>
        <a href={reportHref(p)} target="_blank" rel="noreferrer" className="inline-flex items-center min-h-11 text-accent no-underline">
          정보가 달라졌어요
        </a>
      </p>
      <div className="unfold" data-open={open} id={panelId} role="region" aria-label={`${p.name} 운영 정보`}>
        <div inert={!open} aria-hidden={!open}>
          {everOpened && <Details p={p} />}
        </div>
      </div>
    </li>
  );
}

function Details({ p }: { p: Place }) {
  // 확인된 정보만 줄로 보여 주고, 끝까지 모르는 항목은 아래 한 줄로 모은다
  const rows: [string, React.ReactNode][] = [];
  const unknown: string[] = [];
  const add = (k: string, v: React.ReactNode | null | undefined) => (v ? rows.push([k, v]) : unknown.push(k));
  add("운영 시간", p.hours);
  add("쉬는 날", p.closedDays);
  if (p.agesText) rows.push(["이용 연령", p.agesText]);
  if (p.reservation) rows.push(["예약", <>{p.reservation.need === "yes" ? "예약해요. " : "예약 없이 가요. "}{p.reservation.note}</>]);
  const am = (v: boolean | null, t: string, f: string) => (v === true ? t : v === false ? f : null);
  add("수유실", am(p.amenities.nursingRoom, "있어요.", "없어요."));
  add("기저귀 교환대", am(p.amenities.diaperTable, "있어요.", "없어요."));
  add("유모차", am(p.amenities.strollerAccess, "들어갈 수 있어요.", "들어가기 어려워요."));
  const own = p.parkingNote ?? am(p.amenities.parking, "주차장이 있어요.", "주차장이 없어요.");
  const lot = p.nearbyParking;
  if (own || lot)
    rows.push([
      "주차",
      <>
        {own && <span className="block">{own}</span>}
        {lot && (
          <span className={`block num ${own ? "text-ink-3 mt-1" : ""}`}>
            가까운 공영주차장 {lot.name} · 약 {lot.m}m{lot.spaces ? ` · ${lot.spaces}면` : ""}{lot.fee ? ` · ${lot.fee}` : ""}
          </span>
        )}
      </>,
    ]);
  else unknown.push("주차");
  if (p.manager) rows.push(["관리", p.manager]);
  if (p.phone) rows.push(["전화", <a href={`tel:${p.phone.replace(/[^0-9]/g, "")}`} className="inline-block py-1 num text-accent no-underline">{p.phone}</a>]);
  if (p.homepage) rows.push(["홈페이지", <a href={p.homepage} target="_blank" rel="noreferrer" className="inline-block py-1 break-all text-accent no-underline">{p.category === "kidscafe" ? "우리동네키움포털 시설 안내·예약" : new URL(p.homepage).hostname.replace(/^www\./, "")}</a>]);
  return (
    <div className="mt-1 rounded-sm bg-band px-4 py-3 text-sm">
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <dt className="text-ink-3">지도 앱</dt>
        <dd className="flex gap-4">
          <a href={kakaoMapHref(p)} target="_blank" rel="noreferrer" className="inline-block py-1 text-accent no-underline">
            카카오맵
          </a>
          <a href={naverMapHref(p)} target="_blank" rel="noreferrer" className="inline-block py-1 text-accent no-underline">
            네이버 지도
          </a>
        </dd>
      </dl>
      {unknown.length > 0 && (
        <p className="mt-3 text-ink-2">
          {unknown.join("·")} 정보는 공공데이터와 공식 안내에 없어요. {p.phone ? <>가기 전에 <span className="num">{p.phone}</span>로 물어보세요.</> : "가기 전에 시설에 물어보세요."}
        </p>
      )}
      <div className="mt-3 pt-3 border-t border-rule text-ink-3 flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span className="num">확인일은 공공데이터 기준일이에요.</span>
        <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="inline-block py-1">
          출처 · {new URL(p.sourceUrl).hostname.replace(/^www\./, "")}
        </a>
        {p.detailSource && (
          <a href={p.detailSource} target="_blank" rel="noreferrer" className="inline-block py-1">
            운영 정보 · 우리동네키움포털
          </a>
        )}
        {lot && (
          <a href="https://www.data.go.kr/data/15012896/standard.do" target="_blank" rel="noreferrer" className="inline-block py-1">
            주차장 · 전국주차장정보표준데이터
          </a>
        )}
        {p.reservation?.sourceUrl && (
          <a href={p.reservation.sourceUrl} target="_blank" rel="noreferrer" className="inline-block py-1">
            예약 안내 · {new URL(p.reservation.sourceUrl).hostname}
          </a>
        )}
      </div>
    </div>
  );
}
