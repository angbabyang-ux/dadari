// 계산 엔진의 입력·출력 타입
import type { AllowanceTier, Benefit, Category, Status } from "../data/schema";

export type Employment = "insured" | "uninsured-self" | "none";

export type ParentInput = {
  employment: Employment;
  wage: number; // 월 통상임금(원)
  leave?: { startMonth: number; months: number }; // 시작 시점(아이 생후 개월), 기간(개월)
};

export type CareInput = {
  daycareFrom?: number; // 어린이집 시작(생후 개월)
  kindergartenFrom?: number; // 유치원 시작(생후 개월)
  kindergartenKind?: "public" | "private";
};

export type Input = {
  birthDate: string; // YYYY-MM-DD (예정일 포함)
  expected: boolean;
  birthOrder: number; // 이번에 태어나는 (첫) 아이의 출생순위
  multiples: number; // 1=단태아, 2=쌍둥이 …
  care: CareInput;
  sido: string;
  sigungu?: string;
  tierOverride?: AllowanceTier;
  moveInDate?: string; // 현재 주소지 전입일. 없으면 1년 이상 거주로 가정
  householdSize: number;
  monthlyIncome?: number; // 세전 가구 월소득. 없으면 소득 요건은 '확인 필요'
  homeless: boolean;
  jeonse?: number;
  monthlyRent?: number;
  singleParent: boolean;
  mother: ParentInput;
  father: ParentInput;
};

export type Scenario = "current" | "with-proposals";

export type Item = {
  benefitId: string;
  name: string;
  amount: number;
  category: Category;
  status: Status;
  level: Benefit["level"];
  tags: Benefit["tags"];
  formula: string;
  child?: number; // 몇 번째 아이(다태아)
  parent?: "mother" | "father";
  auto: boolean; // 신청 없이 지급
  deferred?: string; // 거주기간 때문에 미뤄진 경우 설명
  conditional?: string; // 입력이 부족해 조건부로 넣은 경우
};

export type MonthRow = {
  month: string; // YYYY-MM
  ageMonths: number;
  items: Item[];
  total: number;
};

export type Excluded = { benefit: Benefit; reason: string };

export type LeaveMonth = { parent: "mother" | "father"; index: number; ageMonths: number; amount: number; cap: number; rule: "general" | "six-plus-six" | "single-parent" };

export type LeaveResult = {
  sixPlusSix: boolean;
  allowedMonths: { mother: number; father: number };
  months: LeaveMonth[];
  warnings: string[];
};

export type Result = {
  rows: MonthRow[];
  excluded: Excluded[]; // 조건 미충족·정부안 제외
  ended: Excluded[]; // 종료된 제도
  info: Benefit[]; // 금액을 계산하지 않는 혜택 카드
  leave: LeaveResult;
  pendingReform: boolean; // 2027-07 이후 출생인데 정부안을 끈 상태
  afterSchool: Item[]; // 입학 이후로 넘어가 계산 범위 밖인 분할 지급분
};
