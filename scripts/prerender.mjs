// 빌드 후 경로·지역별 정적 HTML(고유 제목·설명), 404 대체 페이지, sitemap.xml, robots.txt를 만든다
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DIST = "dist";
const { render } = await import(pathToFileURL(resolve("dist-ssr/entry-server.js")).href);
const BASE = "/dadari/";
// 쿼리에 따라 내용이 바뀌는 결과·비교 화면은 HTML을 미리 그리지 않고 같은 톤의 로딩 문구만 넣는다
const LOADING = `<div style="max-width:72rem;margin:0 auto;padding:4rem 1rem"><p>결과를 계산하고 있어요.</p></div>`;
const SITE = (process.env.SITE_URL ?? "http://localhost:4173/dadari/").replace(/\/?$/, "/");
const regions = JSON.parse(readFileSync("src/data/regions.json", "utf8"));
const template = readFileSync(join(DIST, "index.html"), "utf8");

const DEFAULT_DESC =
  "아이가 태어난 달부터 초등학교 입학 전까지, 우리 집이 매달 받을 수 있는 지원금을 거주지와 육아휴직 계획까지 반영해 달력처럼 보여줘요.";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function page(path, title, desc, { ssr = true } = {}) {
  const url = SITE + path;
  let html = template.replaceAll("%SITE_URL%", SITE);
  const body = ssr ? render(BASE + path) : LOADING;
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`);
  const file = join(DIST, path, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  return url;
}

const urls = [];
urls.push(page("", "다달이 — 출산·육아 지원금 월별 계산", DEFAULT_DESC));
page("result/", "계산 결과 — 다달이", DEFAULT_DESC, { ssr: false });
page("compare/", "지역별 출산지원금 비교 — 다달이", "지금 조건 그대로 사는 곳만 바꿔 두 지역의 출산·육아 지원금을 나란히 비교해요.", { ssr: false });
urls.push(page("changes/", "2027년에 바뀌는 출산 지원금 — 다달이", "2027년 1월 21일 자동지급, 7월 1일 아이맞이지원금·아동기본수당 정부안까지 출생일에 따라 무엇이 달라지는지 보여줘요."));
urls.push(page("data/", "데이터 출처와 계산 방법 — 다달이", "다달이가 쓰는 출산·육아 지원 정책 데이터의 출처, 마지막 확인일, 계산 방법이에요."));

for (const r of regions.sigungu) {
  const short = r.sido === "서울특별시" ? "서울" : "경기";
  urls.push(
    page(
      `r/${r.id}/`,
      `${r.sigungu} 출산지원금 계산 (${short} ${r.sigungu}) — 다달이`,
      `${short} ${r.sigungu}에 살면 아이가 태어나서 초등학교 입학 전까지 매달 받는 국가·${short === "서울" ? "서울시" : "경기도"}·${r.sigungu} 지원금과 육아휴직 급여를 달력으로 계산해요.`,
    ),
  );
}

// GitHub Pages는 없는 경로에서 404.html을 보여준다 → 앱이 주소를 읽어 화면을 그린다
writeFileSync(join(DIST, "404.html"), template.replaceAll("%SITE_URL%", SITE));

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`,
);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
rmSync("dist-ssr", { recursive: true, force: true });
console.log(`prerendered ${urls.length + 2} pages for ${SITE}`);
