// 장소 카드: 이름·한 줄 소개·실내/야외·연령·요금·주소를 보여 주고, 누르면 운영 정보와 출처가 펼쳐진다
import { useId, useState } from "react";
import type { Place } from "../../data/schema";
import { AGE_LABEL } from "../../places/filter";
import { kakaoMapHref, naverMapHref, reportHref } from "../../places/links";

export const SETTING_LABEL: Record<Place["setting"], string> = { indoor: "실내", outdoor: "야외", mixed: "실내외" };
export const CATEGORY_LABEL: Record<Place["category"], string> = { kidscafe: "키즈카페", library: "도서관", museum: "박물관·미술관", park: "공원" };

const NEED = <span className="badge badge-check">확인 필요</span>;

function feeText(p: Place) {
  if (p.fee.free === true) return "무료";
  return p.fee.text ?? "요금 확인 필요";
}
function agesText(p: Place) {
  return p.ages ? p.ages.map((a) => AGE_LABEL[a]).join(" · ") : "추천 연령 확인 필요";
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

function yes(v: boolean | null, t: string, f: string) {
  return v === true ? t : v === false ? f : NEED;
}

function Details({ p }: { p: Place }) {
  const rows: [string, React.ReactNode][] = [
    ["운영 시간", p.hours ?? NEED],
    ["쉬는 날", p.closedDays ?? NEED],
    [
      "예약",
      p.reservation ? (
        <>
          {p.reservation.need === "yes" ? "예약해요. " : "예약 없이 가요. "}
          {p.reservation.note}
        </>
      ) : (
        NEED
      ),
    ],
    ["수유실", yes(p.amenities.nursingRoom, "있어요.", "없어요.")],
    ["기저귀 교환대", yes(p.amenities.diaperTable, "있어요.", "없어요.")],
    ["유모차", yes(p.amenities.strollerAccess, "들어갈 수 있어요.", "들어가기 어려워요.")],
    ["주차", yes(p.amenities.parking, "주차장이 있어요.", "주차장이 없어요.")],
  ];
  if (p.agesText) rows.splice(2, 0, ["이용 연령", p.agesText]);
  if (p.phone) rows.push(["전화", <a href={`tel:${p.phone.replace(/[^0-9]/g, "")}`} className="inline-block py-1 num">{p.phone}</a>]);
  return (
    <div className="mt-1 rounded-sm bg-band px-4 py-3 text-sm">
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <dt className="text-ink-2">홈페이지</dt>
        <dd>
          {p.homepage ? (
            <a href={p.homepage} target="_blank" rel="noreferrer" className="inline-block py-1 break-all">
              {new URL(p.homepage).hostname.replace(/^www\./, "")}
            </a>
          ) : (
            NEED
          )}
        </dd>
        <dt className="text-ink-2">지도 앱</dt>
        <dd className="flex gap-4">
          <a href={kakaoMapHref(p)} target="_blank" rel="noreferrer" className="inline-block py-1">
            카카오맵
          </a>
          <a href={naverMapHref(p)} target="_blank" rel="noreferrer" className="inline-block py-1">
            네이버 지도
          </a>
        </dd>
      </dl>
      <div className="mt-3 pt-3 rule-t text-ink-2 flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span className="num">확인일은 공공데이터 기준일이에요.</span>
        <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="inline-block py-1">
          출처 · {new URL(p.sourceUrl).hostname.replace(/^www\./, "")}
        </a>
        {p.reservation?.sourceUrl && (
          <a href={p.reservation.sourceUrl} target="_blank" rel="noreferrer" className="inline-block py-1">
            예약 안내 · {new URL(p.reservation.sourceUrl).hostname}
          </a>
        )}
      </div>
      <p className="mt-2 text-ink-2">가기 전에 운영 여부를 시설에 확인해 주세요.</p>
    </div>
  );
}
