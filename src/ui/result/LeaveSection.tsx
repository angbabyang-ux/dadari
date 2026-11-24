// 육아휴직 섹션: "육아휴직 써요" 스위치, 휴직 혜택 묶음 카드, 신청 기한 경고, 시나리오 비교 표
import { useMemo, type ReactNode } from "react";
import type { Benefit } from "../../data/schema";
import { formatWon } from "../../engine/money";
import type { Input, Result, Scenario } from "../../engine/types";
import { availablePlans, compareScenarios, leaveBundle, PLAN_LABEL, type LeavePlan } from "./leavePlan";
import { StatusBadge } from "./parts";

const WHO = { mother: "엄마", father: "아빠" } as const;

function ym(s: string) {
  return `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월`;
}
function ymd(s: string) {
  return `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`;
}

export function LeaveSwitch({ input, plan, onChange }: { input: Input; plan: LeavePlan; onChange: (p: LeavePlan) => void }) {
  const avail = availablePlans(input);
  const on = plan !== "off";
  if (avail.length === 0) {
    return (
      <p className="py-3 text-sm text-ink-2">육아휴직 급여는 고용보험에 가입한 부모가 받아요. 입력 4단계에서 고용 형태를 바꾸면 계산해요.</p>
    );
  }
  const pick = avail.includes("b") ? "b" : avail[0]!;
  return (
    <div className="py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(on ? "off" : pick)}
        className="inline-flex items-center gap-3 min-h-11 pr-2 font-semibold text-left"
      >
        <span aria-hidden className={`relative inline-block w-12 h-7 rounded-full border transition-colors ${on ? "bg-ink border-ink" : "bg-card border-rule"}`}>
          <span className={`absolute top-0.5 w-5.5 h-5.5 rounded-full transition-[left] ${on ? "left-[calc(100%-1.5rem)] bg-paper" : "left-0.5 bg-ink-2"}`} />
        </span>
        육아휴직 써요
      </button>
      {on && avail.length > 1 && (
        <div className="seg flex flex-wrap" role="radiogroup" aria-label="누가 쓰나요">
          {avail.map((p) => (
            <label key={p}>
              <input type="radio" name="leave-plan" checked={plan === p} onChange={() => onChange(p)} />
              {PLAN_LABEL[p]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-x-3 py-1">
      <dt className="text-ink-2">{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}

function InfoRow({ b, period }: { b: Benefit; period: string }) {
  return (
    <li className="py-3 rule-t">
      <p className="font-semibold">
        {b.name} <StatusBadge status={b.status} />
      </p>
      <dl className="text-sm mt-1">
        <Row k="금액" v={b.schedule.type === "info" ? b.schedule.amountText ?? "확인 필요" : "확인 필요"} />
        <Row k="받는 기간" v={period} />
        <Row k="신청처" v={b.apply.url ? <a href={b.apply.url} target="_blank" rel="noreferrer">{b.apply.where}</a> : b.apply.where} />
        <Row k="신청 기한" v={b.apply.deadline ?? "확인 필요"} />
      </dl>
    </li>
  );
}

export function LeaveCard({ applied, result, input, scenario }: { applied: Input; result: Result; input: Input; scenario: Scenario }) {
  const bundle = leaveBundle(applied, result);
  const rows = useMemo(() => (availablePlans(input).includes("b") ? compareScenarios(input, scenario) : []), [input, scenario]);
  // 합계가 같은 조합이 여럿이면 모두 "가장 많아요"
  const maxTotal = rows.length ? Math.max(...rows.map((r) => r.total)) : -1;
  const isBest = (r: { total: number }) => r.total === maxTotal && maxTotal > 0;
  const wageMissing = (["mother", "father"] as const).some((w) => applied[w].leave && !applied[w].wage);

  return (
    <section aria-labelledby="leave-card" className="border border-ink rounded-sm bg-card px-4 md:px-6 py-4 mt-2">
      <h2 id="leave-card" className="font-serif text-xl font-semibold">휴직하면 받는 것</h2>
      {wageMissing && <p className="text-sm mt-1">통상임금을 넣지 않아 하한액(월 70만 원)으로 계산했어요. 입력 4단계에서 넣으면 정확해져요.</p>}

      <ul className="mt-2">
        {bundle.parents.map((p) => (
          <li key={p.parent} className="py-3 rule-t">
            <div className="flex items-baseline gap-3">
              <p className="font-semibold flex-1">{WHO[p.parent]} 육아휴직 급여</p>
              <p className="num font-semibold">{formatWon(p.total)}</p>
            </div>
            <dl className="text-sm mt-1">
              <Row k="받는 기간" v={`${ym(p.from)} ~ ${ym(p.to)} (${p.months}개월)`} />
              <Row k="계산" v={bundle.sixPlusSix ? (p.months > 6 ? "첫 6개월은 6+6 상한, 그다음은 일반 상한" : "6+6 상한을 적용했어요") : "월별 상한·하한을 적용했어요"} />
              <Row k="신청처" v={<a href="https://www.work24.go.kr/" target="_blank" rel="noreferrer">고용24</a>} />
              <Row k="신청 기한" v={`${ymd(p.deadline)}까지`} />
            </dl>
          </li>
        ))}

        {bundle.sixPlusSix && (
          <li className="py-3 rule-t">
            <div className="flex items-baseline gap-3">
              <p className="font-semibold flex-1">6+6 부모육아휴직제 추가분</p>
              <p className="num font-semibold">{formatWon(bundle.sixPlusSixExtra)}</p>
            </div>
            <p className="text-sm mt-1">두 분 모두 아이 생후 18개월 안에 휴직을 시작해서 첫 6개월 상한이 올라갔어요.</p>
            <p className="text-sm text-ink-2">위 육아휴직 급여에 이미 들어 있는 금액이에요.</p>
          </li>
        )}

        {bundle.local.map((l) => (
          <li key={l.benefit.id} className="py-3 rule-t">
            <div className="flex items-baseline gap-3">
              <p className="font-semibold flex-1">
                {l.benefit.name} <StatusBadge status={l.benefit.status} />
              </p>
              <p className="num font-semibold">{formatWon(l.total)}</p>
            </div>
            <dl className="text-sm mt-1">
              <Row k="받는 기간" v={`휴직한 ${l.months}개월`} />
              <Row k="신청처" v={l.benefit.apply.url ? <a href={l.benefit.apply.url} target="_blank" rel="noreferrer">{l.benefit.apply.where}</a> : l.benefit.apply.where} />
              <Row k="신청 기한" v={l.benefit.apply.deadline ?? "구청·시청 공고로 확인 필요"} />
            </dl>
          </li>
        ))}
        {bundle.localExcluded.map((e) => (
          <li key={e.benefit.id} className="py-3 rule-t text-sm">
            <p className="font-semibold">{e.benefit.name}</p>
            <p>받을 수 없어요. {e.reason}</p>
          </li>
        ))}

        <InfoRow b={bundle.info[0]!} period="12세 이하 자녀를 키우며 근무시간을 줄인 기간" />
        <InfoRow b={bundle.info[1]!} period="출산 후 120일 안에 20일" />
      </ul>

      {bundle.parents.length > 0 && (
        <div role="note" className="mt-3 border-l-4 border-ink bg-paper-2 px-3 py-3">
          <p className="font-semibold">신청 기한을 꼭 지켜요.</p>
          <p className="text-sm">육아휴직 급여는 휴직이 끝나고 12개월 안에 신청하지 않으면 받을 수 없어요.</p>
          <p className="text-sm">휴직을 시작하고 1개월이 지나면 고용24에서 신청할 수 있어요.</p>
        </div>
      )}
      {bundle.warnings.map((w) => (
        <p key={w} className="text-sm mt-2">{w}</p>
      ))}

      {rows.length > 0 && (
        <div className="mt-6">
          <h3 className="font-serif text-lg font-semibold pb-1">어떻게 나눠 쓰면 가장 많이 받을까요?</h3>
          <p className="text-sm text-ink-2">휴직 급여와 지자체 장려금을 더한 값이에요. 부모급여·아동수당은 어느 조합이든 같아요.</p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm num">
              <caption className="sr-only">육아휴직 조합별 금액 비교</caption>
              <thead>
                <tr className="rule-b text-left text-ink-2">
                  <th scope="col" className="py-2 font-medium">조합</th>
                  <th scope="col" className="py-2 font-medium text-right hidden sm:table-cell">휴직 급여</th>
                  <th scope="col" className="py-2 font-medium text-right hidden sm:table-cell">지자체</th>
                  <th scope="col" className="py-2 font-medium text-right">합계</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={`rule-b ${isBest(r) ? "bg-paper-2" : ""}`}>
                    <th scope="row" className="py-3 pl-1 text-left font-semibold">
                      {r.label}
                      {isBest(r) && <span className="badge ml-2 bg-ink text-paper border-ink font-normal">가장 많아요</span>}
                    </th>
                    <td className="py-3 text-right hidden sm:table-cell">{formatWon(r.pay)}</td>
                    <td className="py-3 text-right hidden sm:table-cell">{r.local ? formatWon(r.local) : "—"}</td>
                    <td className={`py-3 pr-1 text-right ${isBest(r) ? "font-semibold" : ""}`}>{formatWon(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-2 mt-2">엄마만 12개월은 0~11개월, 6+6은 각 6개월(순차는 엄마 0~5개월 뒤 아빠 6~11개월)로 계산했어요.</p>
        </div>
      )}
    </section>
  );
}
