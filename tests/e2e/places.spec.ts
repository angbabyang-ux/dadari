// 아이랑 갈 곳: 메뉴 → 서울 → 강서구 → 실내만 → 카드 펼치기 → 지원금 계산 이동, 실내 페이지 바로 들어가기, 지도 지연 로딩
import { expect, test } from "@playwright/test";

test("아이랑 갈 곳에서 강서구 실내 장소를 보고 지원금 계산으로 넘어간다", async ({ page, isMobile }) => {
  await page.goto("./");
  const nav = page.getByRole("navigation", { name: "주 메뉴" });
  await nav.getByRole("link", { name: "아이랑 갈 곳" }).click();
  await expect(page).toHaveURL(/\/places\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("아이랑 갈 곳");

  await page.getByRole("link", { name: /^서울/ }).click();
  await expect(page).toHaveURL(/\/places\/seoul\/$/);
  await page.getByRole("link", { name: /^강서구/ }).click();
  await expect(page).toHaveURL(/\/places\/seoul\/gangseo\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("강서구에서 아이랑 갈 곳");
  await expect(page).toHaveTitle(/강서구 아이랑 갈 만한 곳 — 실내·무료·연령별/);

  const cards = page.locator("main ul > li[id]");
  const before = await cards.count();
  expect(before).toBeGreaterThanOrEqual(10);
  await page.getByRole("button", { name: "실내만" }).click();
  await expect(page).toHaveURL(/in=1/);
  await expect(page.getByRole("button", { name: "실내만" })).toHaveAttribute("aria-pressed", "true");
  const after = await cards.count();
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThan(before);
  await expect(cards.locator(".badge", { hasText: /^야외$/ })).toHaveCount(0);

  // 카드 펼치기: 운영 정보와 출처, 확인일·제보 링크
  const first = cards.first();
  await expect(first.getByText(/마지막 확인 \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(first.getByRole("link", { name: "정보가 달라졌어요" })).toBeVisible();
  await first.getByRole("button", { expanded: false }).click();
  const panel = first.getByRole("region", { name: /운영 정보$/ });
  await expect(panel.getByText("운영 시간")).toBeVisible();
  await expect(panel.getByRole("link", { name: /^출처/ })).toBeVisible();

  // 바닥의 교차 링크 → 지원금 계산 (사는 곳이 미리 채워진 지역 랜딩)
  await page.getByRole("link", { name: "강서구 출산·육아 지원금 계산하기" }).click();
  await expect(page).toHaveURL(/\/r\/seoul-gangseo\/$/);
  await expect(page).toHaveTitle(/강서구 출산지원금 계산/);
  void isMobile;
});

test("실내 페이지로 바로 들어와도 목록이 보이고 시·도와 시·군을 고를 수 있다", async ({ page }) => {
  await page.goto("./places/indoor/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("비 오는 날, 눈 오는 날, 너무 더운 날.");
  const count = page.locator("p[aria-live]", { hasText: /곳$/ });
  await expect(count).toHaveText(/^\d+곳$/);
  const cards = page.locator("main ul > li[id]");
  await expect(cards.first()).toBeVisible();
  await expect(cards.locator(".badge", { hasText: /^야외$/ })).toHaveCount(0);
  // 무료로 확인된 곳이 먼저
  await expect(cards.first().locator(".badge", { hasText: "무료" })).toBeVisible();

  await page.getByText("경기", { exact: true }).click();
  await expect(page).toHaveURL(/sd=gyeonggi/);
  await page.getByRole("combobox", { name: "시·군·구" }).selectOption({ label: "수원시" });
  await expect(page).toHaveURL(/sg=gyeonggi-suwon/);
  await expect(cards.first()).toContainText(/./);
  await expect(page.getByRole("link", { name: "수원시의 야외 장소까지 모두 보기" })).toBeVisible();
});

test("지도 라이브러리는 지도 보기를 누를 때만 불러온다", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", (r) => {
    if (/MapView|leaflet/i.test(r.url())) loaded.push(r.url());
  });
  await page.goto("./places/gyeonggi/suwon/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("수원시에서 아이랑 갈 곳");
  expect(loaded).toEqual([]);
  await page.getByText("지도", { exact: true }).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect(loaded.some((u) => /MapView/.test(u))).toBe(true);
  await expect(page.locator(".leaflet-interactive").first()).toBeAttached();
});
