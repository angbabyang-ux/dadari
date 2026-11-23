// 달력 리본: 한 달에 막대 하나, 지급 형태별로 쌓는 가로 스크롤 SVG 차트
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { MonthRow } from "../../engine/types";
import { formatWon } from "../../engine/money";

const BAR = 14;
const GAP = 5;
const STEP = BAR + GAP;
const CHART_H = 168;
const TOP = 34;
const AXIS_H = 48;

type Seg = { key: string; color: string; pattern?: string };
const SEGS: Seg[] = [
  { key: "cash", color: "var(--cash)" },
  { key: "leave-pay", color: "var(--leave)" },
  { key: "voucher", color: "var(--voucher)" },
  { key: "local-currency", color: "var(--voucher)", pattern: "url(#dots)" },
];

export type Milestone = { age: number; label: string };

function compactWon(won: number): string {
  if (won >= 10000) return `${Math.round(won / 10000).toLocaleString("ko-KR")}만`;
  return `${won.toLocaleString("ko-KR")}`;
}

export function Ribbon({
  rows,
  selected,
  onSelect,
  currentMonth,
  milestones,
}: {
  rows: MonthRow[];
  selected?: number;
  onSelect: (age: number) => void;
  currentMonth: string;
  milestones: Milestone[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const cap = useMemo(() => {
    const totals = rows.map((r) => r.total).filter((t) => t > 0).sort((a, b) => a - b);
    if (totals.length === 0) return 1;
    const p85 = totals[Math.floor(totals.length * 0.85)] ?? totals[totals.length - 1]!;
    return Math.max(p85 * 1.35, 1);
  }, [rows]);
  const width = rows.length * STEP + GAP;
  const currentIndex = rows.findIndex((r) => r.month === currentMonth);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = currentIndex > 0 ? currentIndex * STEP - el.clientWidth / 3 : 0;
    el.scrollLeft = Math.max(0, target);
  }, [currentIndex]);

  const y = (v: number) => (Math.min(v, cap) / cap) * CHART_H;

  return (
    <div ref={scroller} className="overflow-x-auto overscroll-x-contain -mx-4 px-4 md:mx-0 md:px-0 no-print" tabIndex={-1}>
      <svg width={width} height={TOP + CHART_H + AXIS_H} role="group" aria-label="월별 수령액 막대 차트. 막대를 누르면 그 달의 내역을 보여줘요." className="block select-none">
        <defs>
          <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--paper)" opacity="0.15" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--paper)" strokeWidth="2.2" />
          </pattern>
          <pattern id="dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="var(--voucher)" />
            <circle cx="2" cy="2" r="0.9" fill="var(--paper)" />
          </pattern>
        </defs>

        {/* 기준선 */}
        <line x1={0} x2={width} y1={TOP + CHART_H + 0.5} y2={TOP + CHART_H + 0.5} stroke="var(--rule)" />

        {rows.map((r, i) => {
          const x = GAP + i * STEP;
          let acc = 0;
          const clipped = r.total > cap;
          const rects: ReactNode[] = [];
          for (const s of SEGS) {
            const items = r.items.filter((it) => it.category === s.key || (s.key === "voucher" && it.category === "service"));
            const confirmed = items.filter((it) => it.status === "confirmed").reduce((a, c) => a + c.amount, 0);
            const draft = items.filter((it) => it.status !== "confirmed").reduce((a, c) => a + c.amount, 0);
            for (const [v, isDraft] of [[confirmed, false], [draft, true]] as const) {
              if (v <= 0) continue;
              const y0 = y(acc);
              const y1 = y(acc + v);
              acc += v;
              const h = y1 - y0;
              if (h <= 0) continue;
              rects.push(<rect key={`${s.key}${isDraft}`} x={x} y={TOP + CHART_H - y1} width={BAR} height={h} fill={s.pattern ?? s.color} />);
              if (isDraft) rects.push(<rect key={`${s.key}h`} x={x} y={TOP + CHART_H - y1} width={BAR} height={h} fill="url(#hatch)" />);
            }
          }
          const hasLocal = r.items.some((it) => it.level !== "national" && it.amount > 0);
          const isSel = selected === i;
          const label = `${Number(r.month.slice(0, 4))}년 ${Number(r.month.slice(5))}월, 생후 ${r.ageMonths}개월, ${formatWon(r.total)}`;
          return (
            <g
              key={r.month}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSel}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(i);
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible>.focus]:opacity-100"
            >
              <rect x={x - GAP / 2} y={0} width={STEP} height={TOP + CHART_H + AXIS_H} fill="transparent" />
              <rect className="focus" x={x - 2} y={TOP - 4} width={BAR + 4} height={CHART_H + 8} fill="none" stroke="var(--focus)" strokeWidth={2} opacity={isSel ? 1 : 0} />
              {rects}
              {clipped && (
                <>
                  <path d={`M${x - 1} ${TOP + 8} l${(BAR + 2) / 2} -4 l${(BAR + 2) / 2} 4`} stroke="var(--paper)" strokeWidth={3} fill="none" />
                  <text x={i === 0 ? x - 2 : x + BAR / 2} y={TOP - 8 - (i > 0 && rows[i - 1]!.total > cap && (i < 2 || rows[i - 2]!.total <= cap) ? 12 : 0)} textAnchor={i === 0 ? "start" : "middle"} fontSize={10} fill="var(--ink)" className="num">
                    {compactWon(r.total)}
                  </text>
                </>
              )}
              {hasLocal && <rect x={x + BAR / 2 - 2} y={TOP + CHART_H + 3} width={4} height={4} fill="var(--local)" />}
              {i === currentIndex && (
                <>
                  <path d={`M${x + BAR / 2 - 4} ${TOP + CHART_H + 15} l4 -6 l4 6 z`} fill="var(--accent)" />
                  <text x={x + BAR / 2} y={TOP + CHART_H + 27} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--accent)">
                    지금
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* 연도·이정표 눈금 */}
        {rows.map((r, i) => {
          const x = GAP + i * STEP;
          const m = Number(r.month.slice(5));
          const ms = milestones.find((s) => s.age === i);
          return (
            <g key={`t${r.month}`} pointerEvents="none">
              {m === 1 && (
                <>
                  <line x1={x - GAP / 2} x2={x - GAP / 2} y1={TOP} y2={TOP + CHART_H + 44} stroke="var(--rule)" strokeDasharray="2 3" />
                  <text x={x - GAP / 2 + 3} y={TOP + CHART_H + 43} fontSize={11} fill="var(--ink-2)" className="num">
                    {r.month.slice(0, 4)}
                  </text>
                </>
              )}
              {ms && i !== currentIndex && (
                <text x={x} y={TOP + CHART_H + 27} fontSize={11} fill="var(--ink-2)">
                  {ms.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
