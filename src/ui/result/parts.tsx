// 결과 화면 공통 조각: 상태 배지, 근거 보기, 카운트업 숫자
import { useLayoutEffect, useRef, useState } from "react";
import type { Benefit } from "../../data/schema";
import { formatWon } from "../../engine/money";

// 강조색은 총액·증가분·'지금' 표시에만 쓴다. 배지는 잉크색과 테두리 모양으로 구분한다
export function StatusBadge({ status }: { status: Benefit["status"] }) {
  if (status === "confirmed") return <span className="badge">확정</span>;
  if (status === "proposed") return <span className="badge badge-accent badge-proposed">정부안</span>;
  if (status === "ended") return <span className="badge line-through">종료</span>;
  return <span className="badge badge-check">확인 필요</span>;
}

export function Evidence({ benefit, formula }: { benefit: Benefit; formula?: string }) {
  return (
    <details className="text-sm group">
      <summary className="cursor-pointer text-accent font-medium w-fit inline-flex items-center min-h-11">근거 보기</summary>
      <div className="mb-2 pl-3 border-l-2 border-rule space-y-1">
        {formula && <p className="num">계산 · {formula}</p>}
        {benefit.notes && <p>{benefit.notes}</p>}
        {benefit.assumption && <p className="text-ink-2">가정 · {benefit.assumption}</p>}
        <p className="text-ink-2 num">마지막 확인 {benefit.lastVerified}</p>
        <ul className="space-y-0.5">
          {benefit.sourceUrl.map((u) => (
            <li key={u} className="truncate">
              <a href={u} target="_blank" rel="noreferrer" className="inline-block py-1">
                {new URL(u).hostname.replace(/^www\./, "")}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** 결과 숫자가 바뀔 때 직전 값에서 새 값으로 짧게 올라가는 숫자. 움직임 줄이기 설정이면 바로 바뀐다 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(0); // 처음 나타날 때도 0에서 올라간다
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = value;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === value) {
      setShown(value);
      return;
    }
    setShown(from); // 그리기 전에 출발값으로 맞춰 깜빡임을 없앤다
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(k < 1 ? Math.round((from + (value - from) * eased) / 10000) * 10000 : value);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={`num ${className ?? ""}`} aria-label={formatWon(value)}>
      {formatWon(shown)}
    </span>
  );
}
