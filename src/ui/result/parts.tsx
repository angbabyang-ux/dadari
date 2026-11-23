// 결과 화면 공통 조각: 상태 배지, 근거 보기, 카운트업 숫자
import { useEffect, useState } from "react";
import type { Benefit } from "../../data/schema";
import { formatWon } from "../../engine/money";
import { STATUS_LABEL } from "./aggregate";

export function StatusBadge({ status }: { status: Benefit["status"] }) {
  if (status === "confirmed") return <span className="badge text-ink-2">확정</span>;
  if (status === "proposed") return <span className="badge badge-proposed text-ink">정부안</span>;
  if (status === "ended") return <span className="badge text-ink-2 line-through">종료</span>;
  return <span className="badge text-accent">{STATUS_LABEL[status]}</span>;
}

export function Evidence({ benefit, formula }: { benefit: Benefit; formula?: string }) {
  return (
    <details className="mt-2 text-sm group">
      <summary className="cursor-pointer text-ink-2 underline underline-offset-4 decoration-rule w-fit">근거 보기</summary>
      <div className="mt-2 pl-3 border-l-2 border-rule space-y-1">
        {formula && <p className="num">계산 · {formula}</p>}
        {benefit.notes && <p>{benefit.notes}</p>}
        {benefit.assumption && <p className="text-ink-2">가정 · {benefit.assumption}</p>}
        <p className="text-ink-2 num">마지막 확인 {benefit.lastVerified}</p>
        <ul className="space-y-0.5">
          {benefit.sourceUrl.map((u) => (
            <li key={u} className="truncate">
              <a href={u} target="_blank" rel="noreferrer">
                {new URL(u).hostname.replace(/^www\./, "")}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** 결과 숫자가 자리 잡을 때 짧게 올라가는 숫자. 움직임 줄이기 설정을 존중한다 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round((from + (value - from) * eased) / 10000) * 10000);
      if (k < 1) raf = requestAnimationFrame(tick);
      else setShown(value);
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
