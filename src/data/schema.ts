// 정책 데이터(JSON)의 zod 스키마와 타입 정의
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 해요");
const won = z.number().int().nonnegative();

export const Status = z.enum(["confirmed", "proposed", "ended", "needs-check"]);
export const Category = z.enum(["cash", "voucher", "local-currency", "service", "tax", "leave-pay"]);
export const Tag = z.enum(["parental-leave", "housing", "childcare", "health", "multi-child"]);
export const Level = z.enum(["national", "sido", "sigungu"]);
export const AllowanceTier = z.enum(["capital", "non-capital", "depop-preferred", "depop-special"]);

const DateRange = z.object({ from: isoDate.optional(), to: isoDate.optional() });

/** 지급 대상 판정 규칙 */
export const EligibilityRule = z.discriminatedUnion("type", [
  // 출생순위 (1=첫째). max 생략 시 상한 없음
  z.object({ type: z.literal("birthOrder"), min: z.number().int().min(1).optional(), max: z.number().int().optional() }),
  // 기준 중위소득 대비 가구 소득 상한 (%)
  z.object({ type: z.literal("incomePct"), max: z.number().positive() }),
  // 거주기간. ref=birth 출생일 기준, ref=apply 신청일(출생월 다음 달로 가정) 기준
  // deferIfShort=true면 충족 시점으로 지급을 미룸, false면 미충족 시 0원
  z.object({
    type: z.literal("residence"),
    days: z.number().int().positive(),
    ref: z.enum(["birth", "apply"]),
    deferIfShort: z.boolean(),
  }),
  // 출산 예정(아직 태어나지 않음)일 때만 표시
  z.object({ type: z.literal("expectedOnly") }),
  // 무주택 + 전세·월세 상한 (서울 주거비)
  z.object({ type: z.literal("homeless"), maxJeonse: won, maxMonthlyEquiv: won }),
  // 한부모
  z.object({ type: z.literal("singleParent") }),
  // 고용 형태. 둘 중 한 부모라도 해당하면 대상
  z.object({
    type: z.literal("employment"),
    parent: z.enum(["mother", "father", "either"]),
    anyOf: z.array(z.enum(["insured", "uninsured-self", "none"])).min(1),
  }),
  // 다태아 가정일 때만
  z.object({ type: z.literal("multipleBirth") }),
]);

/** 나이(생후 개월) 구간별 월 정액 */
const MonthlyBand = z.object({
  fromMonth: z.number().int().min(0),
  toMonth: z.number().int().positive(), // 미포함
  amount: won.optional(),
  amountByTier: z.record(AllowanceTier, won).optional(),
});

/** 지급 일정 규칙 */
export const ScheduleRule = z.discriminatedUnion("type", [
  // 일시금. amountsByOrder[0]=첫째 … 마지막 값이 그 이상 순위에 적용. null=해당 순위 지원 없음
  // split: 균등 분할 횟수와 간격(개월). firstOffsetMonths: 출생월 기준 첫 지급 월(0=출생월)
  z.object({
    type: z.literal("lumpSum"),
    amountsByOrder: z.array(won.nullable()).min(1),
    firstOffsetMonths: z.number().int().min(0),
    split: z.object({ count: z.number().int().min(2), intervalMonths: z.number().int().positive() }).optional(),
    // 순위별 분할 금액을 직접 적을 때 (합계는 amountsByOrder와 같아야 함). intervalMonths 간격
    installmentsByOrder: z.array(z.array(won).nullable()).optional(),
    intervalMonths: z.number().int().positive().optional(),
    perChild: z.boolean(),
  }),
  // 월 정액(생후 개월 구간). childcare: 어린이집 이용 시 처리
  //  - subtract-fee: 보육료 단가를 빼고 차액만 (부모급여)
  //  - home-only: 어린이집·유치원 이용 월은 0원 (가정양육수당, 가정보육 추가분)
  //  - none: 보육 형태와 무관
  z.object({
    type: z.literal("monthly"),
    bands: z.array(MonthlyBand).min(1),
    childcare: z.enum(["subtract-fee", "home-only", "none"]),
    payDay: z.number().int().min(1).max(31).optional(),
  }),
  // 휴직 월마다 정액 (지자체 육아휴직 장려금)
  z.object({
    type: z.literal("perLeaveMonth"),
    parent: z.enum(["father", "mother", "any"]),
    amount: won,
    maxMonths: z.number().int().positive(),
    excludeSixPlusSix: z.boolean(), // 6+6 부모육아휴직제 적용자는 제외
  }),
  // 유아 학급 연령(3·4·5세반, 출생연도+나이+1년 3월 ~ 다음 해 2월) 동안 기관별 월 경감액
  z.object({
    type: z.literal("classAge"),
    ages: z.array(z.union([z.literal(3), z.literal(4), z.literal(5)])).min(1),
    amountByFacility: z.object({ daycare: won, publicKindergarten: won, privateKindergarten: won }),
  }),
  // 엔진 내부 공식 (육아휴직 급여 등)
  z.object({ type: z.literal("formula"), formula: z.enum(["parental-leave"]) }),
  // 금액을 계산하지 않는 혜택 카드
  z.object({ type: z.literal("info"), amountText: z.string().optional() }),
]);

export const Benefit = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  level: Level,
  region: z.object({ sido: z.string(), sigungu: z.string().optional() }).optional(),
  category: Category,
  tags: z.array(Tag),
  status: Status,
  summary: z.string().min(1),
  birthDateRange: DateRange.optional(),
  calendarRange: DateRange.optional(),
  // 이 날짜 이후 출생아는 정부안 개편 대상: '정부안 포함'이면 빠지고, '확정만'이면 "바뀔 수 있음" 표시와 함께 계산
  supersededFrom: isoDate.optional(),
  eligibility: z.array(EligibilityRule),
  schedule: ScheduleRule,
  apply: z.object({
    where: z.string(),
    url: z.url().optional(),
    deadline: z.string().optional(),
    auto: z.boolean().optional(),
    // 이 날짜 이후 출생아는 신청 없이 자동 지급
    autoFromBirth: isoDate.optional(),
  }),
  notes: z.string().optional(),
  assumption: z.string().optional(), // 출처가 정하지 않아 우리가 가정한 부분
  sourceUrl: z.array(z.url()).min(1),
  lastVerified: isoDate,
});

/** 지역 단위에 현금 지원이 없음을 명시하는 기록 */
export const RegionRecord = z.object({
  sido: z.string(),
  sigungu: z.string(),
  id: z.string().regex(/^[a-z0-9-]+$/),
  allowanceTier: AllowanceTier,
  // 자체 현금 출산지원금: has=있음(데이터 있음) / none=없음 확인 / unknown=확인하지 못함
  cashGrant: z.enum(["has", "none", "unknown"]),
  homepage: z.url(),
  note: z.string().optional(),
  sourceUrl: z.array(z.url()).min(1),
  lastVerified: isoDate,
});

export const RegionsFile = z.object({
  sidoList: z.array(z.object({ name: z.string(), id: z.string(), capital: z.boolean() })),
  sigungu: z.array(RegionRecord),
});

const LeaveBand = z.object({
  fromMonth: z.number().int().min(1),
  toMonth: z.number().int().min(1), // 포함
  rate: z.number().positive().max(1),
  cap: won,
});

export const LeaveRules = z.object({
  floor: won,
  baseMonths: z.number().int().positive(),
  extendedMonths: z.number().int().positive(),
  extensionMinEachMonths: z.number().int().positive(),
  general: z.array(LeaveBand),
  sixPlusSix: z.object({ withinChildMonths: z.number().int().positive(), caps: z.array(won), rate: z.number() }),
  singleParent: z.array(LeaveBand),
  sourceUrl: z.array(z.url()).min(1),
  lastVerified: isoDate,
});

export const Reference = z.object({
  medianIncome: z.record(z.string(), z.record(z.string(), won)), // 연도 → 가구원 수 → 월액
  childcareFee: z.object({ year: z.number(), age0: won, age1: won }),
  sourceUrl: z.array(z.url()).min(1),
  lastVerified: isoDate,
});

export const BenefitsFile = z.array(Benefit);

export type Benefit = z.infer<typeof Benefit>;
export type EligibilityRule = z.infer<typeof EligibilityRule>;
export type ScheduleRule = z.infer<typeof ScheduleRule>;
export type RegionRecord = z.infer<typeof RegionRecord>;
export type RegionsFile = z.infer<typeof RegionsFile>;
export type LeaveRules = z.infer<typeof LeaveRules>;
export type Reference = z.infer<typeof Reference>;
export type AllowanceTier = z.infer<typeof AllowanceTier>;
export type Status = z.infer<typeof Status>;
export type Category = z.infer<typeof Category>;
