// 금액을 "185만 원", "10만 5천 원"처럼 읽기 쉽게 바꾸는 함수
export function formatWon(won: number): string {
  const n = Math.round(won);
  if (n === 0) return "0원";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const man = Math.floor(abs / 10000);
  const rest = abs % 10000;
  const restText = rest === 0 ? "" : rest % 1000 === 0 ? `${rest / 1000}천` : rest.toLocaleString("ko-KR");
  if (man === 0) return `${sign}${restText}${rest % 1000 === 0 ? " 원" : "원"}`;
  const manText = `${man.toLocaleString("ko-KR")}만`;
  if (rest === 0) return `${sign}${manText} 원`;
  return `${sign}${manText} ${restText}${rest % 1000 === 0 ? " 원" : "원"}`;
}
