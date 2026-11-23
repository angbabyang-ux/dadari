// 첫 화면의 4단계 입력(아이 → 사는 곳 → 우리 집 → 일과 휴직). 입력값은 URL에 바로 반영된다
import { useState } from "react";
import { reference, regions } from "../data";
import { computeLeave, monthlyLeavePay } from "../engine/leave";
import { incomePercent } from "../engine/timeline";
import { formatWon } from "../engine/money";
import type { Employment, ParentInput } from "../engine/types";
import { leaveRules } from "../data";
import { navigate, replaceQuery } from "../router";
import { draftToParams, isComplete, type Draft } from "../state/url";
import { Field, ManwonInput, MonthSelect, Segmented } from "./fields";

const STEPS = ["아이", "사는 곳", "우리 집", "일과 휴직"] as const;
const TODAY = new Date().toISOString().slice(0, 10);

export function Wizard({ draft }: { draft: Draft }) {
  const [step, setStep] = useState(0);
  const update = (patch: Partial<Draft>) => replaceQuery(draftToParams({ ...draft, ...patch }));
  const canNext = step === 0 ? /^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate) : step === 1 ? draft.sido !== "" : true;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="grid md:grid-cols-12 gap-x-8">
        <div className="md:col-span-4 pt-8 md:pt-14">
          {/* 웹폰트가 늦게 도착해 줄 수가 바뀌어도 아래 입력란이 밀리지 않게 높이를 잡아 둔다 */}
          <h1 className="font-serif text-[28px] md:text-[40px] leading-[1.25] font-semibold tracking-tight min-h-[3.75em] md:min-h-0">
            아이가 태어난 달부터 입학 전까지, 매달 받는 돈을 달력으로 봐요.
          </h1>
          <p className="mt-3 text-ink-2 min-h-[4.8em] md:min-h-0">
            국가·시도·시군구 지원과 육아휴직 급여를 한 번에 계산해요. 입력한 내용은 이 브라우저 밖으로 나가지 않아요.
          </p>
          <ol className="mt-6 hidden md:block rule-t" aria-label="입력 단계">
            {STEPS.map((s, i) => (
              <li key={s} className="rule-b py-2 flex gap-3 items-baseline">
                <span className={`num text-sm ${i === step ? "text-accent font-bold" : "text-ink-2"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={i === step ? "font-semibold" : "text-ink-2"} aria-current={i === step ? "step" : undefined}>
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <form
          className="md:col-span-8 pt-6 md:pt-14 pb-32"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canNext) return;
            if (last && isComplete(draft)) navigate("result", draftToParams(draft));
            else setStep(step + 1);
          }}
        >
          <p className="md:hidden text-sm text-ink-2 num" aria-live="polite">
            {step + 1} / {STEPS.length} 단계
          </p>
          <h2 className="font-serif text-2xl font-semibold mt-1 pb-2 rule-b">{STEPS[step]}</h2>
          {step === 0 && <StepChild draft={draft} update={update} />}
          {step === 1 && <StepPlace draft={draft} update={update} />}
          {step === 2 && <StepHome draft={draft} update={update} />}
          {step === 3 && <StepWork draft={draft} update={update} />}

          <div className="fixed md:static bottom-0 inset-x-0 bg-paper rule-t md:border-0 px-4 md:px-0 py-3 md:pt-6 flex gap-2 z-10 no-print">
            {step > 0 && (
              <button type="button" className="btn" onClick={() => setStep(step - 1)}>
                이전
              </button>
            )}
            <button type="submit" className="btn btn-primary flex-1 md:flex-none md:min-w-48" disabled={!canNext}>
              {last ? "결과 보기" : "다음"}
            </button>
            {step >= 1 && !last && isComplete(draft) && (
              <button type="button" className="btn hidden sm:inline-flex" onClick={() => navigate("result", draftToParams(draft))}>
                여기까지로 결과 보기
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

type StepProps = { draft: Draft; update: (p: Partial<Draft>) => void };

function StepChild({ draft, update }: StepProps) {
  const careMode = draft.care.kindergartenFrom !== undefined ? "kg" : draft.care.daycareFrom !== undefined ? "dc" : "home";
  return (
    <>
      <Field label="출생일 또는 출산 예정일" htmlFor="birth" hint="아직 태어나지 않았다면 예정일을 넣어요.">
        <input
          id="birth"
          type="date"
          className="field max-w-56 num"
          value={draft.birthDate}
          min="2020-01-01"
          max="2030-12-31"
          onChange={(e) => update({ birthDate: e.target.value, expected: e.target.value > TODAY })}
          required
        />
        {draft.birthDate && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.expected} onChange={(e) => update({ expected: e.target.checked })} />
            출산 예정이에요 (아직 태어나지 않았어요).
          </label>
        )}
      </Field>
      <Segmented
        legend="몇째 아이인가요?"
        cols={3}
        value={draft.birthOrder}
        onChange={(v) => update({ birthOrder: v })}
        options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: ["첫째", "둘째", "셋째", "넷째", "다섯째 이상"][n - 1]! }))}
      />
      <Segmented
        legend="한 번에 몇 명이 태어나나요?"
        cols={3}
        hint="쌍둥이라면 아이마다 출생순위를 따로 셈해요. 첫 출산 쌍둥이는 첫째와 둘째예요."
        value={draft.multiples}
        onChange={(v) => update({ multiples: v })}
        options={[
          { value: 1, label: "한 명" },
          { value: 2, label: "쌍둥이" },
          { value: 3, label: "세쌍둥이" },
        ]}
      />
      <Segmented
        legend="보육 계획"
        hint="아직 모르면 집에서 키우는 것으로 계산해요. 결과 화면에서도 바꿀 수 있어요."
        value={careMode}
        onChange={(v) =>
          update({
            care:
              v === "home" ? {} : v === "dc" ? { daycareFrom: draft.care.daycareFrom ?? 12 } : { daycareFrom: draft.care.daycareFrom, kindergartenFrom: draft.care.kindergartenFrom ?? 38, kindergartenKind: draft.care.kindergartenKind ?? "public" },
          })
        }
        options={[
          { value: "home", label: "아직 모름 · 가정양육" },
          { value: "dc", label: "어린이집" },
          { value: "kg", label: "유치원" },
        ]}
      />
      {careMode !== "home" && (
        <Field label="어린이집 시작" htmlFor="dc" hint={careMode === "kg" ? "유치원 전에 어린이집을 다니지 않으면 '안 다님'을 골라요." : undefined}>
          <select
            id="dc"
            className="field max-w-56"
            value={draft.care.daycareFrom ?? -1}
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ care: { ...draft.care, daycareFrom: v < 0 ? undefined : v } });
            }}
          >
            {careMode === "kg" && <option value={-1}>안 다님</option>}
            {Array.from({ length: 61 }, (_, m) => (
              <option key={m} value={m}>
                {m === 0 ? "태어난 달" : `생후 ${m}개월`}
              </option>
            ))}
          </select>
        </Field>
      )}
      {careMode === "kg" && (
        <>
          <Field label="유치원 시작" htmlFor="kg" hint="유치원은 만 3세반부터 다닐 수 있어요.">
            <MonthSelect id="kg" value={draft.care.kindergartenFrom ?? 38} from={36} to={72} onChange={(n) => update({ care: { ...draft.care, kindergartenFrom: n } })} />
          </Field>
          <Segmented
            legend="유치원 종류"
            value={draft.care.kindergartenKind ?? "public"}
            onChange={(v) => update({ care: { ...draft.care, kindergartenKind: v } })}
            options={[
              { value: "public", label: "공립" },
              { value: "private", label: "사립" },
            ]}
          />
        </>
      )}
    </>
  );
}

function StepPlace({ draft, update }: StepProps) {
  const sigunguList = regions.sigungu.filter((r) => r.sido === draft.sido);
  const detailed = sigunguList.length > 0;
  return (
    <>
      <Field label="시·도" htmlFor="sido">
        <select id="sido" className="field max-w-72" value={draft.sido} onChange={(e) => update({ sido: e.target.value, sigungu: undefined, tierOverride: undefined })} required>
          <option value="">골라 주세요</option>
          {regions.sidoList.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      {detailed && (
        <Field label="시·군·구" htmlFor="sigungu" hint="서울 25개 구와 경기 31개 시·군은 자체 지원까지 계산해요.">
          <select id="sigungu" className="field max-w-72" value={draft.sigungu ?? ""} onChange={(e) => update({ sigungu: e.target.value || undefined })}>
            <option value="">골라 주세요</option>
            {sigunguList.map((r) => (
              <option key={r.id} value={r.sigungu}>
                {r.sigungu}
              </option>
            ))}
          </select>
        </Field>
      )}
      {draft.sido && !detailed && (
        <>
          <p className="py-4 rule-b text-sm">
            이 지역은 국가와 시·도 지원만 계산해요. 시·군·구 지원은{" "}
            <a href="https://www.gov.kr/portal/rcvfvrSvc/main" target="_blank" rel="noreferrer">
              정부24 보조금24
            </a>
            에서 확인해 주세요.
          </p>
          <Segmented
            legend="사는 곳이 인구감소지역인가요?"
            hint="아동수당 금액이 달라져요. 모르면 기본값으로 계산해요."
            value={draft.tierOverride ?? "auto"}
            onChange={(v) => update({ tierOverride: v === "auto" ? undefined : v })}
            options={[
              { value: "auto", label: "모름 · 아니요" },
              { value: "depop-preferred", label: "우대지역" },
              { value: "depop-special", label: "특별지역" },
            ]}
          />
        </>
      )}
      <Field label="지금 주소로 전입한 날" htmlFor="movein" hint="거주기간 조건을 따질 때 써요. 모르면 비워 두세요. 1년 이상 산 것으로 계산해요.">
        <input id="movein" type="date" className="field max-w-56 num" value={draft.moveInDate ?? ""} max={TODAY} onChange={(e) => update({ moveInDate: e.target.value || undefined })} />
      </Field>
    </>
  );
}

function StepHome({ draft, update }: StepProps) {
  const year = draft.birthDate ? Number(draft.birthDate.slice(0, 4)) : 2026;
  const pct = draft.monthlyIncome !== undefined ? incomePercent(draft.monthlyIncome, draft.householdSize, year, reference) : undefined;
  return (
    <>
      <Segmented
        legend="가구원 수"
        hint="태어날 아이를 포함해요."
        value={draft.householdSize}
        onChange={(v) => update({ householdSize: v })}
        options={[2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: n === 7 ? "7명 이상" : `${n}명` }))}
      />
      <Field label="가구 월 소득 (세전)" htmlFor="inc" hint="부부 소득을 더해요. 모르면 비워 두세요. 소득 조건이 있는 지원은 '조건부'로 보여줘요.">
        <ManwonInput id="inc" value={draft.monthlyIncome} onChange={(v) => update({ monthlyIncome: v })} placeholder="예: 600" />
        {pct !== undefined && (
          <p className="mt-2 text-sm num" aria-live="polite">
            {year}년 기준 중위소득의 <strong>{Math.round(pct)}%</strong>예요.
          </p>
        )}
      </Field>
      <div className="py-4 rule-b">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={draft.homeless} onChange={(e) => update({ homeless: e.target.checked })} />
          집이 없어요 (무주택 세입자예요).
        </label>
        {draft.homeless && (
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="js" className="text-sm block mb-1">
                전세 보증금
              </label>
              <ManwonInput id="js" value={draft.jeonse} onChange={(v) => update({ jeonse: v })} placeholder="예: 30000" />
            </div>
            <div>
              <label htmlFor="rt" className="text-sm block mb-1">
                월세
              </label>
              <ManwonInput id="rt" value={draft.monthlyRent} onChange={(v) => update({ monthlyRent: v })} placeholder="예: 120" />
            </div>
          </div>
        )}
      </div>
      <div className="py-4 rule-b">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={draft.singleParent} onChange={(e) => update({ singleParent: e.target.checked })} />
          한부모 가구예요.
        </label>
      </div>
    </>
  );
}

function StepWork({ draft, update }: StepProps) {
  const leave = computeLeave({ ...draft, birthDate: draft.birthDate || TODAY, sido: draft.sido || "서울특별시" }, leaveRules);
  return (
    <>
      <p className="py-3 text-sm text-ink-2 rule-b">
        통상임금 — 매달 고정으로 받는 월급이에요. 성과급·야근수당은 빠져요.
      </p>
      <ParentBlock who="mother" title={draft.singleParent ? "양육자" : "엄마"} draft={draft} update={update} />
      {!draft.singleParent && <ParentBlock who="father" title="아빠" draft={draft} update={update} />}
      <p className="py-4 text-sm" aria-live="polite">
        {leave.sixPlusSix
          ? "두 분 모두 아이 생후 18개월 안에 휴직을 시작해요. 6+6 부모육아휴직제로 첫 6개월 상한이 올라가요."
          : "6+6 부모육아휴직제는 두 부모 모두 아이 생후 18개월 안에 휴직을 시작하면 적용돼요."}
      </p>
    </>
  );
}

function ParentBlock({ who, title, draft, update }: StepProps & { who: "mother" | "father"; title: string }) {
  const p = draft[who];
  const set = (patch: Partial<ParentInput>) => update({ [who]: { ...p, ...patch } } as Partial<Draft>);
  const prefix = who === "mother" ? "m" : "f";
  return (
    <section aria-label={title} className="mt-4">
      <h3 className="font-serif text-xl font-semibold pt-2">{title}</h3>
      <Segmented<Employment>
        legend="고용 형태"
        value={p.employment}
        onChange={(v) => set({ employment: v, leave: v === "insured" ? p.leave : undefined })}
        options={[
          { value: "insured", label: "고용보험 가입 근로자" },
          { value: "uninsured-self", label: "1인 자영업·특고·프리랜서" },
          { value: "none", label: "일하지 않음" },
        ]}
      />
      {p.employment === "insured" && (
        <>
          <Field label="월 통상임금" htmlFor={`${prefix}w`}>
            <ManwonInput id={`${prefix}w`} value={p.wage || undefined} onChange={(v) => set({ wage: v ?? 0 })} placeholder="예: 300" />
          </Field>
          <div className="py-4 rule-b">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={!!p.leave} onChange={(e) => set({ leave: e.target.checked ? { startMonth: who === "mother" ? 0 : 6, months: who === "mother" ? 12 : 6 } : undefined })} />
              육아휴직을 쓸 계획이에요.
            </label>
            {p.leave && (
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${prefix}ls`} className="text-sm block mb-1">
                    시작 시점
                  </label>
                  <MonthSelect id={`${prefix}ls`} value={p.leave.startMonth} to={95} onChange={(n) => set({ leave: { ...p.leave!, startMonth: n } })} />
                </div>
                <div>
                  <label htmlFor={`${prefix}lm`} className="text-sm block mb-1">
                    기간
                  </label>
                  <select id={`${prefix}lm`} className="field max-w-56" value={p.leave.months} onChange={(e) => set({ leave: { ...p.leave!, months: Number(e.target.value) } })}>
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m}개월
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {p.leave && p.wage > 0 && (
              <p className="mt-2 text-sm text-ink-2 num">일반 육아휴직이면 첫 달 급여는 {formatWon(monthlyLeavePay(p.wage, 1, leaveRules.general[0]!.cap, leaveRules.floor))}이에요.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
