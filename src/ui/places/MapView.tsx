// 지도 보기: Leaflet + OpenStreetMap 타일. 지도 버튼을 누를 때만 이 파일과 Leaflet을 불러온다
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Place } from "../../data/schema";
import { SETTING_LABEL } from "./PlaceCard";

export default function MapView({ places, onPick }: { places: Place[]; onPick: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const map = L.map(box.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자',
    }).addTo(map);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#1C1B19";
    const local = css.getPropertyValue("--local").trim() || "#3E6B58";
    const markers = places.map((p) => {
      const m = L.circleMarker([p.lat, p.lng], { radius: 8, weight: 2, color: ink, fillColor: p.setting === "outdoor" ? local : ink, fillOpacity: 0.85 });
      // 팝업 내용은 문자열 HTML이 아니라 DOM으로 만든다 (데이터에 든 글자를 그대로 보여 주기 위해)
      const el = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = p.name;
      const meta = document.createElement("div");
      meta.textContent = `${SETTING_LABEL[p.setting]} · ${p.fee.free === true ? "무료" : p.fee.text ?? "요금 확인 필요"}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "목록에서 보기";
      btn.style.cssText = "margin-top:6px;text-decoration:underline;min-height:32px";
      btn.onclick = () => onPick(p.id);
      el.append(name, meta, btn);
      return m.bindPopup(el).addTo(map);
    });
    if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15), { maxZoom: 15 });
    else map.setView([37.55, 126.99], 11);
    return () => void map.remove();
  }, [places, onPick]);
  return <div ref={box} className="h-[60vh] min-h-80 w-full border border-rule" role="region" aria-label="장소 지도" />;
}
