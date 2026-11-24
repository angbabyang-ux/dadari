// 정책 데이터가 스키마와 무결성 규칙을 지키는지 검사하는 테스트
import { describe, expect, it } from "vitest";
import { BenefitsFile, LeaveRules, Reference, RegionsFile } from "../../src/data/schema";
import { benefits, leaveRules, reference, regions } from "../../src/data";

const SEOUL_GU = "종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구".split(" ");
const GG_SIGUN = "수원시 고양시 용인시 성남시 부천시 화성시 안산시 남양주시 안양시 평택시 시흥시 파주시 의정부시 김포시 광주시 광명시 군포시 하남시 오산시 양주시 이천시 구리시 안성시 포천시 의왕시 양평군 여주시 동두천시 가평군 과천시 연천군".split(" ");

describe("정책 데이터", () => {
  it("모든 혜택이 zod 스키마를 통과한다", () => {
    const r = BenefitsFile.safeParse(benefits);
    if (!r.success) throw new Error(JSON.stringify(r.error.issues.slice(0, 5), null, 2));
  });

  it("지역·휴직·참고 데이터가 스키마를 통과한다", () => {
    expect(() => RegionsFile.parse(regions)).not.toThrow();
    expect(() => LeaveRules.parse(leaveRules)).not.toThrow();
    expect(() => Reference.parse(reference)).not.toThrow();
  });

  it("id가 겹치지 않는다", () => {
    const ids = benefits.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 항목에 출처와 확인일이 있다", () => {
    for (const b of benefits) {
      expect(b.sourceUrl.length, b.id).toBeGreaterThan(0);
      expect(b.lastVerified, b.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("서울 25개 구와 경기 31개 시군이 모두 지역 데이터에 있다", () => {
    const names = (sido: string) => regions.sigungu.filter((r) => r.sido === sido).map((r) => r.sigungu);
    expect(names("서울특별시").sort()).toEqual([...SEOUL_GU].sort());
    expect(names("경기도").sort()).toEqual([...GG_SIGUN].sort());
  });

  it("현금 지원이 '있음'인 지역은 해당 지역 혜택 데이터가 있다", () => {
    for (const r of regions.sigungu.filter((x) => x.cashGrant === "has")) {
      const found = benefits.some((b) => b.region?.sido === r.sido && b.region?.sigungu === r.sigungu);
      expect(found, r.sigungu).toBe(true);
    }
  });

  it("혜택의 시군구 이름은 지역 데이터에 있는 이름이다", () => {
    const known = new Set(regions.sigungu.map((r) => `${r.sido}/${r.sigungu}`));
    for (const b of benefits) {
      if (b.region?.sigungu) expect(known.has(`${b.region.sido}/${b.region.sigungu}`), b.id).toBe(true);
    }
  });

  it("'이렇게 써요'는 사용 기한을 하나로 정하거나, 기한 없음·확인 필요를 밝힌다", () => {
    for (const b of benefits) {
      const u = b.usage;
      if (!u) continue;
      const rules = [u.expiresAfterDays, u.expiresAfterMonths, u.expiresOn, u.noExpiry || undefined].filter((x) => x !== undefined);
      expect(rules.length, b.id).toBeLessThanOrEqual(1);
      if (rules.length === 0) expect(u.unverified?.some((x) => x.includes("사용 기한")), b.id).toBe(true);
    }
  });

  it("첫만남이용권·부모급여·아동수당·서울형 산후조리경비에 '이렇게 써요'가 있다", () => {
    for (const id of ["first-meeting-voucher", "parent-pay", "child-allowance", "seoul-postpartum-care"]) {
      expect(benefits.find((b) => b.id === id)?.usage, id).toBeDefined();
    }
  });

  it("분할 금액의 합은 순위별 총액과 같다", () => {
    for (const b of benefits) {
      if (b.schedule.type !== "lumpSum" || !b.schedule.installmentsByOrder) continue;
      expect(b.schedule.intervalMonths, b.id).toBeDefined();
      b.schedule.installmentsByOrder.forEach((parts, i) => {
        if (!parts) return;
        const total = b.schedule.type === "lumpSum" ? b.schedule.amountsByOrder[i] : null;
        expect(parts.reduce((a, c) => a + c, 0), `${b.id} ${i + 1}째`).toBe(total);
      });
    }
  });
});
