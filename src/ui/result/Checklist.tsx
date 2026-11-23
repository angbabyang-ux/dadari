// 신청 체크리스트: 신청이 필요한 제도를 시기 순으로 정리하고 .ics 캘린더 파일로 내보낸다
import type { Input, Result } from "../../engine/types";
import { formatWon } from "../../engine/money";
import { benefitById } from "./aggregate";
import { buildIcs, type Task } from "./ics";

export function tasksFrom(result: Result, input: Input): Task[] {
  const tasks = new Map<string, Task>();
  for (const row of result.rows) {
    for (const it of row.items) {
      if (it.auto || tasks.has(it.benefitId)) continue;
      const b = benefitById.get(it.benefitId)!;
      if (b.category === "leave-pay") continue;
      tasks.set(it.benefitId, {
        id: it.benefitId,
        title: `${b.name} 신청`,
        date: `${row.month}-01`,
        where: b.apply.where,
        url: b.apply.url,
        deadline: b.apply.deadline,
        note: it.deferred,
      });
    }
  }
  // 육아휴직 급여: 신청 기한(휴직 종료 후 12개월)이 지나면 0원
  for (const who of ["mother", "father"] as const) {
    const lv = input[who].leave;
    if (!lv || input[who].employment !== "insured") continue;
    const birth = new Date(input.birthDate);
    const start = new Date(birth.getFullYear(), birth.getMonth() + lv.startMonth, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + lv.months, 0);
    const deadline = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate());
    const first = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    tasks.set(`leave-${who}`, {
      id: `leave-${who}`,
      title: `${who === "mother" ? "엄마" : "아빠"} 육아휴직 급여 신청`,
      date: iso(first),
      where: "고용24",
      url: "https://www.work24.go.kr/",
      deadline: `${iso(deadline)}까지 신청해야 해요. 넘기면 받을 수 없어요.`,
      warn: true,
    });
  }
  return [...tasks.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function Checklist({ result, input }: { result: Result; input: Input }) {
  const tasks = tasksFrom(result, input);
  const autoTotal = result.rows.flatMap((r) => r.items).filter((i) => i.auto).reduce((a, c) => a + c.amount, 0);
  const download = () => {
    const blob = new Blob([buildIcs(tasks)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dadari-신청일정.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="pt-6">
      {autoTotal > 0 && <p className="text-sm text-ink-2 pb-3">신청 없이 자동으로 들어오는 돈은 {formatWon(autoTotal)}이에요. 아래는 직접 신청해야 하는 것들이에요.</p>}
      {tasks.length === 0 ? (
        <p className="py-6">직접 신청해야 하는 항목이 없어요.</p>
      ) : (
        <ol className="rule-t">
          {tasks.map((t) => (
            <li key={t.id} className="py-3 rule-b grid grid-cols-[6.5rem_1fr] gap-x-3">
              <span className="num text-sm text-ink-2 pt-0.5">{t.date.slice(0, 7).replace("-", ". ")}</span>
              <div>
                <p className="font-semibold">
                  {t.title}
                  {t.warn && <span className="badge ml-2 text-accent">기한 주의</span>}
                </p>
                <p className="text-sm">
                  {t.url ? (
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.where}
                    </a>
                  ) : (
                    t.where
                  )}
                  {t.deadline ? ` · ${t.deadline}` : ""}
                </p>
                {t.note && <p className="text-sm text-ink-2">{t.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {tasks.length > 0 && (
        <button type="button" className="btn mt-4 no-print" onClick={download}>
          캘린더 파일(.ics)로 받기
        </button>
      )}
    </div>
  );
}
