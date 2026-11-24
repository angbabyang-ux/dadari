// "이렇게 써요" 사용 기한 날짜와 남은 일수 계산을 검사하는 테스트
import { describe, expect, it } from "vitest";
import { benefits } from "../../src/data";
import { dDay, expiryDate } from "../../src/ui/result/usage";

const usage = (id: string) => benefits.find((b) => b.id === id)!.usage!;

describe("사용 기한", () => {
  it("첫만남이용권: 출생일로부터 2년 (2025-01-01생 → 2026-12-31까지)", () => {
    expect(expiryDate(usage("first-meeting-voucher"), "2025-01-01")).toBe("2026-12-31");
    expect(expiryDate(usage("first-meeting-voucher"), "2026-12-15")).toBe("2028-12-14");
  });
  it("서울형 산후조리경비: 출산일로부터 1년이 되는 달의 말일", () => {
    expect(expiryDate(usage("seoul-postpartum-care"), "2026-12-15")).toBe("2027-12-31");
    expect(expiryDate(usage("seoul-postpartum-care"), "2027-01-31")).toBe("2028-01-31");
  });
  it("현금은 기한이 없다", () => {
    expect(expiryDate(usage("parent-pay"), "2026-12-15")).toBeUndefined();
  });
  it("남은 일수 표시", () => {
    expect(dDay("2026-12-31", "2026-09-02")).toBe("D-120");
    expect(dDay("2026-12-31", "2026-12-31")).toBe("D-day");
    expect(dDay("2026-12-31", "2027-01-01")).toBe("기한 지남");
  });
});
