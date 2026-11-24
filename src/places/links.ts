// 장소 카드의 바깥 링크: 지도 앱 열기, "정보가 달라졌어요" 제보(GitHub 이슈)
import type { Place } from "../data/schema";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
// 배포 워크플로가 저장소 이름(owner/repo)을 넣어 준다. 없으면 데이터 페이지의 제보 안내로 보낸다
const REPO: string | undefined = import.meta.env.VITE_REPO || undefined;

export function reportHref(p: Place): string {
  if (!REPO) return `${BASE}/data/#report`;
  const q = new URLSearchParams({
    title: `[정보 수정] ${p.name}`,
    body: `장소: ${p.name} (${p.id})\n주소: ${p.address}\n\n달라진 내용:\n\n확인한 곳(공식 누리집·전화 등):\n`,
  });
  return `https://github.com/${REPO}/issues/new?${q}`;
}

export function kakaoMapHref(p: Place): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(p.name.replace(/,/g, " "))},${p.lat},${p.lng}`;
}
export function naverMapHref(p: Place): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(`${p.name} ${p.address.split(" ").slice(0, 3).join(" ")}`)}`;
}
