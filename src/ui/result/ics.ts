// 신청 일정을 iCalendar(.ics) 텍스트로 만든다 (하루 종일 일정)
export type Task = { id: string; title: string; date: string; where: string; url?: string; deadline?: string; note?: string; warn?: boolean };

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(tasks: Task[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//dadari//ko", "CALSCALE:GREGORIAN"];
  for (const t of tasks) {
    const d = t.date.replace(/-/g, "");
    const desc = [t.where, t.deadline, t.note, t.url].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}-${d}@dadari`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${esc(t.title)}`,
      `DESCRIPTION:${esc(desc)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
