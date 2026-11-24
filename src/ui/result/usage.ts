// "이렇게 써요"의 사용 기한 날짜와 남은 일수(D-N)를 계산한다
import type { Usage } from "../../data/schema";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 출생일 기준 사용 기한(마지막 사용 가능일). 기한이 없거나 모르면 undefined */
export function expiryDate(u: Usage, birthDate: string): string | undefined {
  const [y, m, d] = birthDate.split("-").map(Number) as [number, number, number];
  if (u.expiresOn) return u.expiresOn;
  if (u.expiresAfterDays) return iso(new Date(Date.UTC(y, m - 1, d + u.expiresAfterDays)));
  if (u.expiresAfterMonths) {
    if (u.expiresEndOfMonth) return iso(new Date(Date.UTC(y, m - 1 + u.expiresAfterMonths + 1, 0))); // 그 달 말일
    return iso(new Date(Date.UTC(y, m - 1 + u.expiresAfterMonths, d - 1))); // 출생일 + N개월의 전날
  }
  return undefined;
}

/** today 기준 남은 일수 표시: "D-120", "D-day", "기한 지남" */
export function dDay(expiry: string, today: string): string {
  const diff = Math.round((Date.parse(expiry) - Date.parse(today)) / 86400000);
  if (diff < 0) return "기한 지남";
  if (diff === 0) return "D-day";
  return `D-${diff}`;
}
