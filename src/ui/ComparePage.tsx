// 지역 비교: 지금 입력 그대로 지역만 바꿔 두 곳의 지원금을 나란히 보여준다
import { benefits, leaveRules, reference, regions } from "../data";
import { computeTimeline } from "../engine/timeline";
import { formatWon } from "../engine/money";
import type { Input, Result } from "../engine/types";
import { hrefFor, navigate, replaceQuery } from "../router";
import { scenarioFrom, withDraft } from "../state/url";
import { benefitById, LEVEL_LABEL } from "./result/aggregate";
import { StatusBadge } from "./result/parts";

function totalsByBenefit(r: Result) {
  const m = new Map<string, number>();
  for (const it of r.rows.flatMap((x) => x.items)) m.set(it.benefitId, (m.get(it.benefitId) ?? 0) + it.amount);
  return m;
}

export function ComparePage({ input, params }: { input: Input; params: URLSearchParams }) {
  const scenario = scenarioFrom(params);
  const defaultOther = input.sigungu === "강남구" ? "seoul-gangseo" : "seoul-gangnam";
  const otherId = params.get("cmp") ?? defaultOther;
  const other = regions.sigungu.find((r) => r.id === otherId) ?? regions.sigungu.find((r) => r.id === defaultOther)!;
  const inputB: Input = { ...input, sido: other.sido, sigungu: other.sigungu, tierOverride: undefined };
  const data = { benefits, regions, leaveRules, reference };
  const ra = computeTimeline(input, data, { scenario });
  const rb = computeTimeline(inputB, data, { scenario });
  const ta = ra.rows.reduce((a, r) => a + r.total, 0);
  const tb = rb.rows.reduce((a, r) => a + r.total, 0);
  const ma = totalsByBenefit(ra);
  const mb = totalsByBenefit(rb);
  const ids = [...new Set([...ma.keys(), ...mb.keys()])];
  const diff = ids.filter((id) => (ma.get(id) ?? 0) !== (mb.get(id) ?? 0)).sort((x, y) => Math.abs((mb.get(y) ?? 0) - (ma.get(y) ?? 0)) - Math.abs((mb.get(x) ?? 0) - (ma.get(x) ?? 0)));
  const same = ids.filter((id) => (ma.get(id) ?? 0) === (mb.get(id) ?? 0)).reduce((a, id) => a + (ma.get(id) ?? 0), 0);
  const nameA = `${input.sigungu ?? input.sido}`;
  const nameB = other.sigungu;
  const max = Math.max(ta, tb, 1);

  return (
    <div className="mx-auto max-w-[864px] px-4 pb-16">
      <p className="pt-6 text-sm">
        <a href={hrefFor("result", withDraft(params, input))} onClick={(e) => (e.preventDefault(), navigate("result", withDraft(params, input)))} className="text-accent no-underline font-medium">
          ← 결과로 돌아가기
        </a>
      </p>
      <h1 className="text-2xl md:text-[30px] md:leading-9 font-bold pt-4">다른 동네라면 얼마나 달라질까요?</h1>
      <p className="text-ink-2 pt-2">아이·가구·휴직 조건은 그대로 두고 사는 곳만 바꿔서 계산했어요.</p>

      <div className="pt-6">
        <label htmlFor="cmp" className="text-ink-label block mb-2">
          비교할 지역
        </label>
        <select id="cmp" className="field" value={other.id} onChange={(e) => replaceQuery(withDraft(new URLSearchParams({ ...Object.fromEntries(params), cmp: e.target.value }), input))}>
          {["서울특별시", "경기도"].map((sido) => (
            <optgroup key={sido} label={sido}>
              {regions.sigungu
                .filter((r) => r.sido === sido)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sigungu}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <section aria-label="합계 비교" className="grid sm:grid-cols-2 gap-3 pt-6">
        {[
          [nameA, ta],
          [nameB, tb],
        ].map(([n, t]) => (
          <div key={String(n)} className={`card p-4 ${t === Math.max(ta, tb) && ta !== tb ? "card-best" : "border-rule"}`}>
            {t === Math.max(ta, tb) && ta !== tb && <span className="badge badge-best mb-2">더 많아요</span>}
            <p className="stat-label">{n} · 입학 전까지</p>
            <p className="text-[28px] font-bold leading-tight num text-amount">{formatWon(Number(t))}</p>
            <div className="h-2 mt-3 rounded-full bg-paper-2" aria-hidden>
              <div className="h-2 rounded-full bg-accent" style={{ width: `${(Number(t) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </section>
      <p className="pt-4">
        {ta === tb ? (
          "두 지역의 합계가 같아요."
        ) : (
          <>
            <strong>{ta > tb ? nameA : nameB}</strong>에서 <strong className="text-accent num">{formatWon(Math.abs(ta - tb))}</strong> 더 받아요.
          </>
        )}
      </p>

      <h2 className="text-lg font-bold pt-8 pb-3">달라지는 항목</h2>
      {diff.length === 0 ? (
        <p className="py-4 text-ink-2">달라지는 항목이 없어요.</p>
      ) : (
        <div className="overflow-x-auto card border-rule px-4">
          <table className="w-full text-sm num min-w-[480px]">
            <thead>
              <tr className="rule-b text-left text-ink-2">
                <th scope="col" className="py-2 font-medium">제도</th>
                <th scope="col" className="py-2 font-medium text-right">{nameA}</th>
                <th scope="col" className="py-2 font-medium text-right">{nameB}</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((id) => {
                const b = benefitById.get(id)!;
                return (
                  <tr key={id} className="rule-b">
                    <th scope="row" className="py-3 text-left font-semibold">
                      {b.name} <span className="font-normal text-ink-2">· {LEVEL_LABEL[b.level]}</span> <StatusBadge status={b.status} />
                    </th>
                    <td className="py-3 text-right">{ma.get(id) ? formatWon(ma.get(id)!) : "—"}</td>
                    <td className="py-3 text-right">{mb.get(id) ? formatWon(mb.get(id)!) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="pt-4 text-sm text-ink-2 num">국가·시도 지원 등 두 곳이 똑같이 받는 금액은 {formatWon(same)}이에요.</p>
      {[...new Set([nameA, nameB])].map((n) => {
        const r = regions.sigungu.find((x) => x.sigungu === n);
        return r?.cashGrant === "unknown" ? (
          <p key={n} className="pt-2 text-sm">
            {n} 자체 지원은 확인하지 못해 비교에서 빠졌을 수 있어요.{" "}
            <a href={r.homepage} target="_blank" rel="noreferrer">
              {n} 누리집
            </a>
            에서 확인해 주세요.
          </p>
        ) : null;
      })}
    </div>
  );
}
