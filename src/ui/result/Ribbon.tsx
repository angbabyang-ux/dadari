// 달력 리본: 한 달에 막대 하나, 지급 형태별로 쌓고 맨 위에 육아휴직 층을 올리는 가로 스크롤 SVG 차트
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Item, MonthRow } from "../../engine/types";
import { formatWon } from "../../engine/money";
import { benefits } from "../../data";
import { isLeaveItem } from "./leavePlan";

// 한 번(또는 몇 번 나눠) 받는 일시금. 막대 높이 상한을 정할 때 뺀다
const ONE_OFF = new Set(benefits.filter((b) => b.schedule.type === "lumpSum").map((b) => b.id));

const BAR = 14;
const GAP = 5;
const STEP = BAR + GAP;
const CHART_H = 168;
const TOP = 56; // 위쪽: 육아휴직 라벨 줄(0~24) + 큰 금액 라벨 줄
const AXIS_H = 48;

type Seg = { key: string; match: (it: Item) => boolean; fill: string; leave?: boolean };
// 아래에서 위로 쌓는 순서. 육아휴직은 항상 맨 위 층
const SEGS: Seg[] = [
  { key: "cash", match: (it) => !isLeaveItem(it) && it.category === "cash", fill: "var(--cash)" },
  { key: "voucher", match: (it) => !isLeaveItem(it) && (it.category === "voucher" || it.category === "service"), fill: "var(--voucher)" },
  { key: "local", match: (it) => !isLeaveItem(it) && it.category === "local-currency", fill: "url(#dots)" },
  { key: "leave", match: isLeaveItem, fill: "url(#stripes)", leave: true },
];

export type Milestone = { age: number; label: string };
export type LeaveRun = { from: number; to: number; label: string }; // 생후 개월 구간(포함)

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
  leaveRuns,
  growKey,
}: {
  rows: MonthRow[];
  selected?: number;
  onSelect: (age: number) => void;
  currentMonth: string;
  milestones: Milestone[];
  leaveRuns: LeaveRun[];
  growKey: string; // 바뀌면 육아휴직 층이 다시 자란다
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // 세로 상한: 한 번만 받는 일시금을 뺀 "매달 들어오는 돈"의 최댓값. 육아휴직 층은 항상 다 보이고,
  // 출생 직후 일시금처럼 튀는 달만 꺾임 표시와 실제 금액 라벨로 보여준다
  const cap = useMemo(() => {
    const recurring = rows.map((r) => r.items.filter((it) => !ONE_OFF.has(it.benefitId)).reduce((a, c) => a + c.amount, 0));
    return Math.max(...recurring, 1) * 1.08;
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
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--paper)" strokeWidth="2.2" />
          </pattern>
          <pattern id="dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="var(--voucher)" />
            <circle cx="2" cy="2" r="0.9" fill="var(--paper)" />
          </pattern>
          <pattern id="stripes" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="var(--leave)" />
            <line x1="0" y1="0.5" x2="4" y2="0.5" stroke="var(--paper)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* 육아휴직 구간 라벨: 색과 별개로 글자로도 표시 */}
        {leaveRuns.map((run) => {
          const x0 = GAP + run.from * STEP;
          const x1 = GAP + run.to * STEP + BAR;
          return (
            <g key={`${run.label}${run.from}`} pointerEvents="none">
              <text x={x0} y={13} fontSize={11} fontWeight={600} fill="var(--ink)">
                {run.label}
              </text>
              <path d={`M${x0} 24 V19 H${x1} V24`} fill="none" stroke="var(--ink)" strokeWidth={1} />
            </g>
          );
        })}

        <line x1={0} x2={width} y1={TOP + CHART_H + 0.5} y2={TOP + CHART_H + 0.5} stroke="var(--rule)" />

        {rows.map((r, i) => {
          const x = GAP + i * STEP;
          let acc = 0;
          const clipped = r.total > cap;
          const rects: ReactNode[] = [];
          for (const s of SEGS) {
            const items = r.items.filter(s.match);
            for (const isDraft of [false, true]) {
              const v = items.filter((it) => (it.status !== "confirmed") === isDraft).reduce((a, c) => a + c.amount, 0);
              if (v <= 0) continue;
              const y0 = y(acc);
              const y1 = y(acc + v);
              acc += v;
              const h = y1 - y0;
              if (h <= 0) continue;
              const cls = s.leave ? "grow-up" : undefined;
              const k = s.leave ? `${s.key}${isDraft}${growKey}` : `${s.key}${isDraft}`;
              rects.push(<rect key={k} className={cls} x={x} y={TOP + CHART_H - y1} width={BAR} height={h} fill={s.fill} />);
              if (isDraft) rects.push(<rect key={`${k}h`} className={cls} x={x} y={TOP + CHART_H - y1} width={BAR} height={h} fill="url(#hatch)" />);
            }
          }
          const hasLocal = r.items.some((it) => it.level !== "national" && it.amount > 0);
          const isSel = selected === i;
          const label = `${Number(r.month.slice(0, 4))}년 ${Number(r.month.slice(5))}월, 생후 ${r.ageMonths}개월, ${formatWon(r.total)}`;
          const raise = i > 0 && rows[i - 1]!.total > cap && (i < 2 || rows[i - 2]!.total <= cap) ? 12 : 0;
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
              <rect x={x - GAP / 2} y={TOP - 30} width={STEP} height={CHART_H + AXIS_H + 30} fill="transparent" />
              <rect className="focus" x={x - 2} y={TOP - 4} width={BAR + 4} height={CHART_H + 8} fill="none" stroke="var(--focus)" strokeWidth={2} opacity={isSel ? 1 : 0} />
              {rects}
              {clipped && (
                <>
                  <path d={`M${x - 1} ${TOP + 8} l${(BAR + 2) / 2} -4 l${(BAR + 2) / 2} 4`} stroke="var(--paper)" strokeWidth={3} fill="none" />
                  <text x={i === 0 ? x - 2 : x + BAR / 2} y={TOP - 8 - raise} textAnchor={i === 0 ? "start" : "middle"} fontSize={10} fill="var(--ink)" className="num">
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
