// 입력 화면에서 쓰는 작은 폼 요소들 (라벨·도움말·세그먼트 선택·만 원 단위 숫자)
import { useId, type ReactNode } from "react";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="py-4 rule-b">
      <label htmlFor={htmlFor} className="block font-semibold mb-1">
        {label}
      </label>
      {hint && <p className="text-sm text-ink-2 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
  legend,
  hint,
  value,
  options,
  onChange,
  cols,
}: {
  legend: string;
  hint?: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  cols?: 2 | 3 | 4; // 휴대폰에서 칸 수를 고정해 글꼴이 바뀌어도 줄 수가 같게
}) {
  const name = useId();
  const grid = cols ? { 2: "grid grid-cols-2 sm:flex sm:flex-wrap", 3: "grid grid-cols-3 sm:flex sm:flex-wrap", 4: "grid grid-cols-4 sm:flex sm:flex-wrap" }[cols] : "flex flex-wrap";
  return (
    <fieldset className="py-4 rule-b">
      <legend className="font-semibold mb-1 float-left w-full">{legend}</legend>
      {hint && <p className="text-sm text-ink-2 mb-2 clear-both">{hint}</p>}
      <div className={`seg clear-both pt-1 ${grid}`}>
        {options.map((o) => (
          <label key={String(o.value)}>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 만 원 단위로 입력받아 원으로 돌려준다 */
export function ManwonInput({ id, value, onChange, placeholder }: { id: string; value?: number; onChange: (won?: number) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        className="field num max-w-48"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        value={value === undefined ? "" : String(Math.round(value / 10000))}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          onChange(raw === "" ? undefined : Number(raw) * 10000);
        }}
      />
      <span className="text-ink-2">만 원</span>
    </div>
  );
}

export function MonthSelect({ id, value, onChange, from = 0, to = 72 }: { id: string; value: number; onChange: (n: number) => void; from?: number; to?: number }) {
  return (
    <select id={id} className="field max-w-56" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((m) => (
        <option key={m} value={m}>
          {m === 0 ? "태어난 달" : `생후 ${m}개월${m % 12 === 0 ? ` (만 ${m / 12}세)` : ""}`}
        </option>
      ))}
    </select>
  );
}
