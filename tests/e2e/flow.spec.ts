// 입력 4단계 → 결과 → '육아휴직 관련' 필터 → 지역 비교 → URL 공유로 같은 결과 복원
import { expect, test } from "@playwright/test";

test("입력부터 공유 링크 복원까지 한 줄기", async ({ page, context }) => {
  // 첫 화면에서 지원금 계산으로 들어간다
  await page.goto("./");
  await page.getByRole("main").getByRole("link", { name: "지원금 계산하기" }).click();
  await expect(page).toHaveURL(/\/calc\/$/);

  // 1. 아이
  await page.getByLabel("출생일 또는 출산 예정일").fill("2026-12-15");
  await page.getByRole("button", { name: "다음" }).click();

  // 2. 사는 곳
  await page.getByLabel("시·도").selectOption("서울특별시");
  await page.getByLabel("시·군·구").selectOption("강남구");
  await page.getByRole("button", { name: "다음" }).click();

  // 3. 우리 집
  await page.getByLabel("가구 월 소득 (세전)").fill("600");
  await page.getByRole("button", { name: "다음" }).click();

  // 4. 일과 휴직: 엄마 통상임금 300만, 휴직 12개월
  const mom = page.getByRole("region", { name: "엄마" });
  await mom.getByLabel("월 통상임금").fill("300");
  await mom.getByLabel("육아휴직을 쓸 계획이에요.").check();
  await page.getByRole("button", { name: "결과 보기" }).click();

  // 결과
  await expect(page).toHaveURL(/\/result\/\?/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("2026년 12월");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("강남구");
  const total = page.getByLabel("요약").locator("[aria-label]").first();
  await expect(total).toHaveAttribute("aria-label", /만 원/);
  const totalText = await total.getAttribute("aria-label");

  // 필터: 육아휴직 관련
  await page.getByRole("button", { name: "육아휴직 관련" }).click();
  await expect(page).toHaveURL(/f=leave/);
  await expect(page.getByRole("heading", { name: "0세 동안" })).toBeVisible();
  await expect(page.getByText("육아휴직 급여").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "출생 직후 받는 것" })).toHaveCount(0);

  // 공유 URL 저장
  const shared = page.url();

  // 지역 비교
  await page.getByRole("link", { name: "다른 동네라면?" }).click();
  await expect(page).toHaveURL(/\/compare\/\?/);
  await page.getByLabel("비교할 지역").selectOption({ label: "강서구" });
  await expect(page.getByText("강남구에서")).toBeVisible();
  await expect(page.getByRole("row", { name: /강남구 출산양육지원금/ })).toBeVisible();

  // 새 탭에서 공유 링크 열기 → 같은 결과
  const fresh = await context.newPage();
  await fresh.goto(shared);
  await expect(fresh.getByRole("heading", { level: 1 })).toContainText("강남구");
  await expect(fresh.getByRole("button", { name: "육아휴직 관련" })).toHaveAttribute("aria-pressed", "true");
  await expect(fresh.getByLabel("요약").locator("[aria-label]").first()).toHaveAttribute("aria-label", totalText!);
});

test("직접 진입과 새로고침에서도 화면이 뜬다", async ({ page }) => {
  for (const path of ["changes/", "data/", "result/?b=2027-07-10&sd=seoul&sg=seoul-gangseo&sc=p"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("정부안").first()).toBeVisible();
});

test("월 막대를 키보드로 열고 닫는다", async ({ page }) => {
  await page.goto("result/?b=2026-12-15&sd=seoul&sg=seoul-gangnam");
  const bar = page.locator('svg [role="button"]').nth(1);
  await bar.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("2027년 1월");
  await expect(sheet).toContainText("첫만남이용권");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("육아휴직 스위치로 증가분을 보고, 첫만남이용권 사용처를 펼쳐 본다", async ({ page }) => {
  // 강서구, 엄마만 고용보험(통상임금 300만), 아빠는 일하지 않음 → 스위치를 켜면 엄마 12개월
  await page.goto("result/?b=2026-12-15&sd=seoul&sg=seoul-gangseo&mw=300&fe=n");
  const total = page.getByLabel("요약").locator("[aria-label]").first();
  await expect(total).toHaveAttribute("aria-label", /만 원/);
  const before = await total.getAttribute("aria-label");

  const sw = page.getByRole("switch", { name: "육아휴직 써요" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/lv=m/);

  // 증가분: 지시서 T1과 같은 2,310만 원
  await expect(page.getByTestId("leave-delta")).toHaveText("+2,310만 원 육아휴직으로 늘어요");
  await expect(total).not.toHaveAttribute("aria-label", before!);
  await expect(page.getByRole("heading", { name: "휴직하면 받는 것" })).toBeVisible();
  await expect(page.getByText("휴직이 끝나고 12개월 안에 신청하지 않으면 받을 수 없어요.")).toBeVisible();
  await expect(page.locator("svg text", { hasText: "엄마 육아휴직 12개월" })).toBeVisible();

  // 끄면 원래 금액으로
  await sw.click();
  await expect(total).toHaveAttribute("aria-label", before!);
  await expect(page.getByTestId("leave-delta")).toHaveText("");

  // 첫만남이용권 "이렇게 써요"
  const card = page.getByRole("button", { name: /첫만남이용권/ }).first();
  await card.click();
  await expect(card).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("region", { name: "첫만남이용권 이렇게 써요" });
  await expect(panel.getByRole("heading", { name: "쓸 수 있는 곳" })).toBeVisible();
  await expect(panel.getByText("온라인 구매도 돼요. 제외 업종은 온라인에서도 안 돼요.")).toBeVisible();
  await expect(panel.getByText(/유흥업소/)).toBeVisible();
  await expect(panel.getByText(/2028년 12월 14일까지/)).toBeVisible();
});
