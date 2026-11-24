// 장소 카드 왼쪽 그림: 자유 이용 사진이 있으면 사진, 없으면 그 자리의 OpenStreetMap 지도 조각과 위치 점
import { useEffect, useRef, useState } from "react";
import type { Place } from "../../data/schema";

// 17단계 조각(256px)을 절반 크기(128px)로 그려 16단계처럼 보이게 한다 → 고밀도 화면에서도 선명
const Z = 17;
const TILE = 128;

/** 위도·경도 → 확대 수준 Z에서의 전체 픽셀 좌표 (웹 메르카토르) */
export function worldPx(lat: number, lng: number, z = Z) {
  // TILE(표시 크기) 기준 픽셀
  const n = TILE * 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return { x, y };
}

/** size×size 창을 덮는 지도 조각들 (최대 2×2) */
export function tilesFor(lat: number, lng: number, size: number) {
  const { x, y } = worldPx(lat, lng);
  const left = x - size / 2;
  const top = y - size / 2;
  const out: { src: string; dx: number; dy: number }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size - 1) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size - 1) / TILE); ty++)
      out.push({ src: `https://tile.openstreetmap.org/${Z}/${tx}/${ty}.png`, dx: Math.round(tx * TILE - left), dy: Math.round(ty * TILE - top) });
  return out;
}

export function PlaceThumb({ p }: { p: Place }) {
  const box = "relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded-sm bg-paper-2";
  if (p.photo)
    return (
      <span className={box}>
        <img src={`${import.meta.env.BASE_URL}${p.photo.url}`} alt={`${p.name} 사진`} width={96} height={96} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      </span>
    );
  return <MapThumb p={p} box={box} />;
}

/** 지도 조각은 카드가 화면 가까이 왔을 때만 받는다 (미리 그린 HTML에는 자리와 위치 점만 → 첫 화면을 늦추지 않게) */
function MapThumb({ p, box }: { p: Place; box: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (!("IntersectionObserver" in window)) return void setShow(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setShow(true), io.disconnect()), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [show]);
  // 96px 창 기준으로 조각을 놓고, 휴대폰(80px)에서는 창 가운데를 기준으로 8px씩 당겨 보인다
  const tiles = show ? tilesFor(p.lat, p.lng, 96) : [];
  return (
    <span ref={ref} className={box} role="img" aria-label={`${p.name} 위치 지도`}>
      <span className="absolute inset-0 -translate-x-2 -translate-y-2 sm:translate-x-0 sm:translate-y-0">
        {tiles.map((t) => (
          <img key={t.src} src={t.src} alt="" width={128} height={128} loading="lazy" decoding="async" fetchPriority="low" className="absolute max-w-none w-32 h-32" style={{ left: t.dx, top: t.dy }} />
        ))}
      </span>
      <span aria-hidden className="absolute left-1/2 top-1/2 -ml-[5px] -mt-[5px] w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-white" />
    </span>
  );
}
