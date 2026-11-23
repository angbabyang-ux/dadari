// 막대를 누르면 아래에서 올라오는 그 달의 상세 내역 시트
import { useEffect, useRef } from "react";
import type { MonthRow } from "../../engine/types";
import { formatWon } from "../../engine/money";
import { benefitById, CATEGORY_LABEL, LEVEL_LABEL } from "./aggregate";
import { Evidence, StatusBadge } from "./parts";

export function MonthSheet({ row, onClose, onPrev, onNext }: { row: MonthRow; onClose: () => void; onPrev?: () => void; onNext?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, row.month]);

  const y = Number(row.month.slice(0, 4));
  const m = Number(row.month.slice(5));
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label={`${y}년 ${m}월 상세 내역`}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto bg-card rule-t shadow-[0_-8px_24px_rgba(0,0,0,0.08)] sheet-in no-print"
    >
      <div className="mx-auto max-w-3xl px-4 md:px-8 pb-6">
        <div className="sticky top-0 bg-card pt-3 pb-2 rule-b flex items-baseline gap-3">
          <div className="flex-1">
            <p className="text-sm text-ink-2 num">
              {y}년 {m}월 · 생후 {row.ageMonths}개월
            </p>
            <p className="font-serif text-2xl font-semibold num">{formatWon(row.total)}</p>
          </div>
          <button type="button" className="btn px-3 min-h-10" onClick={onPrev} disabled={!onPrev} aria-label="이전 달">
            ‹
          </button>
          <button type="button" className="btn px-3 min-h-10" onClick={onNext} disabled={!onNext} aria-label="다음 달">
            ›
          </button>
          <button type="button" className="btn px-3 min-h-10" onClick={onClose}>
            닫기
          </button>
        </div>
        {row.items.length === 0 ? (
          <p className="py-6 text-ink-2">이 달에 들어오는 지원금은 없어요.</p>
        ) : (
          <ul>
            {row.items.map((it, i) => {
              const b = benefitById.get(it.benefitId)!;
              return (
                <li key={`${it.benefitId}-${it.child ?? 0}-${it.parent ?? ""}-${i}`} className="py-3 rule-b">
                  <div className="flex gap-3 items-baseline">
                    <p className="flex-1 font-semibold">
                      {it.name}
                      {it.child ? <span className="text-ink-2 font-normal"> · {it.child}번째 아이</span> : null}
                      {it.parent ? <span className="text-ink-2 font-normal"> · {it.parent === "mother" ? "엄마" : "아빠"}</span> : null}
                    </p>
                    <p className="num font-semibold">{formatWon(it.amount)}</p>
                  </div>
                  <p className="text-sm text-ink-2 flex flex-wrap gap-x-2 gap-y-1 items-center mt-0.5">
                    <StatusBadge status={it.status} />
                    <span>{CATEGORY_LABEL[it.category]}</span>
                    <span aria-hidden>·</span>
                    <span>{LEVEL_LABEL[it.level]}</span>
                    <span aria-hidden>·</span>
                    <span>{it.auto ? "신청 없이 받아요" : b.apply.where}</span>
                  </p>
                  {it.deferred && <p className="text-sm mt-1">{it.deferred}</p>}
                  {it.conditional && <p className="text-sm mt-1">{it.conditional}</p>}
                  {it.mayChange && <p className="text-sm mt-1">{it.mayChange}</p>}
                  <Evidence benefit={b} formula={it.formula} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
