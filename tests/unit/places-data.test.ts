// 아이랑 갈 곳 데이터가 스키마·출처·확인일·지역 규칙을 지키는지 검사하는 테스트
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlacesFile } from "../../src/data/schema";
import { regions } from "../../src/data";
import meta from "../../src/data/places-meta.json";

const DIR = "src/data/places";
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
const targets = regions.sigungu.filter((r) => r.sido === "서울특별시" || r.sido === "경기도");

describe("아이랑 갈 곳 데이터", () => {
  it("서울 25개 구·경기 31개 시군 파일이 모두 있다", () => {
    expect(targets).toHaveLength(56);
    expect(files.sort()).toEqual(targets.map((r) => `${r.id}.json`).sort());
  });

  it.each(files)("%s 가 zod 스키마를 통과한다", (f) => {
    const r = PlacesFile.safeParse(load(f));
    if (!r.success) throw new Error(JSON.stringify(r.error.issues.slice(0, 3), null, 2));
  });

  it("지역마다 10곳 이상이고 파일 이름과 지역이 맞는다", () => {
    for (const f of files) {
      const list = load(f);
      const id = f.replace(/\.json$/, "");
      expect(list.length, id).toBeGreaterThanOrEqual(10);
      for (const p of list) {
        expect(p.sigungu).toBe(id);
        expect(id.startsWith(`${p.sido}-`)).toBe(true);
        const r = targets.find((x) => x.id === id)!;
        expect(p.address.replace(/^서울특별시(\S)/, "서울특별시 $1"), p.name).toContain(r.sigungu);
      }
    }
  });

  it("모든 곳에 공식 출처와 확인일이 있고, 확인일은 미래가 아니다", () => {
    const today = new Date().toISOString().slice(0, 10);
    const known = Object.values(meta.sources).map((s) => s.url);
    for (const f of files)
      for (const p of load(f)) {
        expect(known, p.id).toContain(p.sourceUrl);
        expect(p.lastVerified <= today, `${p.id} ${p.lastVerified}`).toBe(true);
        expect(p.lastVerified >= "2015-01-01", p.id).toBe(true);
      }
  });

  it("id가 전체에서 겹치지 않는다", () => {
    const ids = files.flatMap((f) => load(f).map((p: { id: string }) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("블로그 등 비공식 출처를 쓰지 않는다", () => {
    for (const s of [...Object.values(meta.sources).map((x) => x.url), ...meta.extra]) expect(s).toMatch(/^https:\/\/(data\.seoul\.go\.kr|www\.data\.go\.kr|mediahub\.seoul\.go\.kr)\//);
  });
});
