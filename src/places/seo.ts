// 아이랑 갈 곳 화면별 고유 제목·설명 (미리 그리기와 화면 이동 때 같이 쓴다)
import { counts } from "../data/places-index.json";
import type { PlacesPath } from "../router";
import { placeRegions, regionBySlug, regionsOfSido, SIDO_IDS, SIDO_SHORT, type SidoId } from "./store";

type Count = { total: number; indoor: number; free: number };
const C = counts as Record<string, Count>;
const sum = (ids: string[]) => ids.reduce((a, id) => a + (C[id]?.total ?? 0), 0);
const isSido = (s: string): s is SidoId => (SIDO_IDS as readonly string[]).includes(s);

export function regionCount(id: string): Count {
  return C[id] ?? { total: 0, indoor: 0, free: 0 };
}

export function placesSeo(pp: PlacesPath): { title: string; desc: string } {
  if (pp.kind === "indoor")
    return {
      title: "비 오는 날 아이랑 갈 실내 장소 — 서울·경기 | 다달이",
      desc: "비 오는 날, 눈 오는 날, 너무 더운 날 아이와 갈 만한 서울·경기 실내 공공시설이에요. 무료로 확인된 키즈카페·어린이도서관·박물관을 먼저 보여줘요.",
    };
  if (pp.kind === "sido" && isSido(pp.sido)) {
    const rs = regionsOfSido(pp.sido);
    const short = SIDO_SHORT[pp.sido];
    return {
      title: `${short} 아이랑 갈 만한 곳 — ${rs.length}개 ${pp.sido === "seoul" ? "구" : "시·군"}별 실내·무료 | 다달이`,
      desc: `${short} ${rs.length}개 ${pp.sido === "seoul" ? "구" : "시·군"}에서 아이와 갈 만한 공공시설 ${sum(rs.map((r) => r.id))}곳을 지역별로 모았어요. 실내·무료·연령별로 골라 보세요.`,
    };
  }
  if (pp.kind === "region") {
    const r = regionBySlug(pp.sido, pp.slug);
    if (r) {
      const c = regionCount(r.id);
      const short = r.sido === "서울특별시" ? "서울" : "경기";
      return {
        title: `${r.sigungu} 아이랑 갈 만한 곳 — 실내·무료·연령별 | 다달이`,
        desc: `${short} ${r.sigungu}에서 아이와 갈 만한 곳 ${c.total}곳이에요. 실내 ${c.indoor}곳, 무료 ${c.free}곳을 운영 시간·예약·연령 정보와 함께 공공데이터로 모았어요.`,
      };
    }
  }
  return {
    title: "아이랑 갈 곳 — 서울·경기 아이와 갈 만한 곳 | 다달이",
    desc: `서울 25개 구와 경기 31개 시·군에서 아이와 갈 만한 키즈카페·도서관·박물관·공원 ${sum(placeRegions.map((r) => r.id))}곳을 공공데이터로 모았어요.`,
  };
}
