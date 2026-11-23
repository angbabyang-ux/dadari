// 정책 JSON을 모아 타입을 붙여 내보낸다 (스키마 검증은 테스트에서 수행)
import type { Benefit, LeaveRules, Reference, RegionsFile } from "./schema";
import national from "./national.json";
import seoul from "./seoul.json";
import seoulGu from "./seoul-gu.json";
import gyeonggi from "./gyeonggi.json";
import regionsJson from "./regions.json";
import leaveJson from "./leave-rules.json";
import referenceJson from "./reference.json";

export const benefits = [...national, ...seoul, ...seoulGu, ...gyeonggi] as unknown as Benefit[];
export const regions = regionsJson as unknown as RegionsFile;
export const leaveRules = leaveJson as unknown as LeaveRules;
export const reference = referenceJson as unknown as Reference;
