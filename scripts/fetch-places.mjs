// 공공데이터(서울형 키즈카페, 전국 도서관·박물관미술관·도시공원 표준데이터)를 받아 지역별 「아이랑 갈 곳」 JSON을 만든다
// 실행: node scripts/fetch-places.mjs  (인증키가 필요 없는 공개 내려받기 주소만 쓴다. 하나라도 실패하면 기존 파일을 그대로 둔다)
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const OUT = "src/data/places";
const PER_REGION = 20;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; dadari-data-fetch/1.0)" };
const regions = JSON.parse(readFileSync("src/data/regions.json", "utf8")).sigungu.filter((r) => r.sido === "서울특별시" || r.sido === "경기도");
const SIDO_ID = { 서울특별시: "seoul", 경기도: "gyeonggi" };

export const SOURCES = {
  kidscafe: { name: "서울시 서울형 키즈카페 시설 현황", url: "https://data.seoul.go.kr/dataList/OA-21716/S/1/datasetView.do", org: "서울 열린데이터광장", license: "이용허락범위 제한 없음" },
  library: { name: "전국도서관표준데이터", url: "https://www.data.go.kr/data/15013109/standard.do", org: "공공데이터포털", license: "공공데이터포털 이용정책" },
  museum: { name: "전국박물관미술관정보표준데이터", url: "https://www.data.go.kr/data/15017323/standard.do", org: "공공데이터포털", license: "공공데이터포털 이용정책" },
  park: { name: "전국도시공원정보표준데이터", url: "https://www.data.go.kr/data/15012890/standard.do", org: "공공데이터포털", license: "공공데이터포털 이용정책" },
};
// 서울형 키즈카페 예약 방식·주말 야외형 운영 시기 근거 (서울시 공식 소식)
const KIDS_RESERVE_SRC = "https://mediahub.seoul.go.kr/archives/2008564";
const KIDS_OUTDOOR_SRC = "https://mediahub.seoul.go.kr/archives/2017820";

async function getJson(url, init) {
  const res = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** 공공데이터포털 표준데이터 전체 내려받기 (포털 화면의 내려받기 버튼과 같은 공개 주소) */
async function standard(pk) {
  const h = await getJson(`https://www.data.go.kr/download/columList.json?pk=${pk}&ext=JSON`);
  const out = [];
  for (let page = 1; (page - 1) * 10000 < h.totalCount; page++) {
    const qs = new URLSearchParams({ publicDataPk: pk, svcTableNm: h.tableVO.svcTableNm, perPage: "10000", page: String(page), totalCount: String(h.totalCount) });
    for (const c of h.tableVO.colNmList) qs.append("colNmList", c);
    out.push(...(await getJson(`https://www.data.go.kr/download/standard.json?${qs}`)));
  }
  if (out.length !== h.totalCount) throw new Error(`표준데이터 ${pk}: ${out.length}/${h.totalCount}건만 받음`);
  return out;
}

/** 서울 열린데이터광장 시트 JSON 내려받기 (화면의 내려받기(JSON)와 같은 공개 주소) */
async function seoulSheet(infId) {
  const body = new URLSearchParams({ srvType: "S", infId, serviceKind: "0", pageNo: "1", gridTotalCnt: "", ssUserId: "SAMPLE_VIEW", strWhere: "", strOrderby: "" });
  const j = await getJson("https://datafile.seoul.go.kr/bigfile/iot/sheet/json/download.do", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: "https://data.seoul.go.kr/" },
  });
  if (!Array.isArray(j.DATA) || j.DATA.length === 0) throw new Error(`서울 ${infId}: 데이터 없음`);
  return j.DATA;
}

const clean = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();
const day = (s) => (typeof s === "number" ? new Date(s + 9 * 3600e3).toISOString().slice(0, 10) : clean(s).slice(0, 10)); // 숫자는 밀리초 시각(한국 시간 기준 날짜)
function regionOf(addr) {
  const a = clean(addr).replace(/^서울시\s?|^서울\s/, "서울특별시 ").replace(/^경기\s/, "경기도 ").replace(/^(서울특별시)(\S)/, "$1 $2");
  return regions.find((r) => a.startsWith(`${r.sido} ${r.sigungu}`));
}
function validLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat > 36.8 && lat < 38.4 && lng > 126.3 && lng < 127.9;
}
function hashId(s) {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
}
function hhmm(open, close) {
  const o = clean(open), c = clean(close);
  if (!o || !c || o === "00:00" && c === "00:00") return null;
  return `${o}~${c}`;
}
function url(u) {
  const s = clean(u);
  if (!s || s === "null") return null;
  const v = /^https?:\/\//.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
  try {
    return new URL(v).href;
  } catch {
    return null;
  }
}
const has = (text, re) => (re.test(text) ? true : null);

/** "0세 ~ 6세" → 연령대(0: 0~12개월, 1-3: 1~3세, 4-7: 4~7세)와 겹치는 것 */
export function ageBands(text) {
  const m = clean(text).match(/(\d+)\s*세?\s*[~-]\s*(\d+)\s*세/);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  const bands = [];
  if (a <= 0 && b >= 0) bands.push("0");
  if (a <= 3 && b >= 1) bands.push("1-3");
  if (a <= 7 && b >= 4) bands.push("4-7");
  return bands.length ? bands : null;
}

function base(r, extra) {
  return {
    sido: SIDO_ID[r.sido],
    sigungu: r.id,
    amenities: { nursingRoom: null, diaperTable: null, strollerAccess: null, parking: null },
    homepage: null,
    ...extra,
  };
}

function fromKidscafe(x) {
  const r = regionOf(x.bass_adres);
  const lat = Number(x.y_crdnt_value), lng = Number(x.x_crdnt_value);
  if (!r || !validLatLng(lat, lng)) return null;
  const outdoor = !/키즈카페/.test(x.fclty_nm); // 주말 야외형 '여기저기 서울형 키즈카페'(공원 운영)
  const free = x.rntfee_free_at === "Y" ? true : x.rntfee_free_at === "N" ? false : null;
  const ages = ageBands(x.posbl_agrde);
  const cap = clean(x.indvdl_psncpa);
  return base(r, {
    id: `kc-${clean(x.fclty_id).toLowerCase()}`,
    name: clean(x.fclty_nm),
    address: clean(`${clean(x.bass_adres)} ${clean(x.detail_adres)}`),
    lat,
    lng,
    setting: outdoor ? "outdoor" : "indoor",
    ages,
    agesText: clean(x.posbl_agrde) || null,
    fee: { free, text: free ? "무료" : free === false ? "유료 (금액은 시설에 확인 필요)" : null },
    category: "kidscafe",
    hours: clean(x.open_week) ? `운영 요일 ${clean(x.open_week)}` : null,
    closedDays: clean(x.close_week) || null,
    reservation: outdoor
      ? { need: "yes", note: "우리동네키움포털에서 일정을 확인하고 신청해요. 봄(4~6월)·가을(9~11월) 주말에 운영해요.", sourceUrl: KIDS_OUTDOOR_SRC }
      : { need: "yes", note: "우리동네키움포털에서 사전 예약해요. 시설에 따라 당일 현장 접수가 있어요.", sourceUrl: KIDS_RESERVE_SRC },
    summary: outdoor
      ? `공원에서 주말에 여는 야외형 서울형 키즈카페예요.${ages ? ` 이용 연령은 ${clean(x.posbl_agrde)}예요.` : ""}`
      : `서울시가 운영 기준을 정한 공공 키즈카페예요.${ages ? ` 이용 연령은 ${clean(x.posbl_agrde)}예요.` : ""}${cap ? ` 개인 정원 ${cap}명.` : ""}`,
    phone: clean(x.cttpc) || null,
    source: "kidscafe",
    sourceUrl: SOURCES.kidscafe.url,
    lastVerified: day(x.updt_dt) || day(x.regist_dt),
  });
}

function fromLibrary(x) {
  if (x.LBRRY_SE !== "공공도서관" && x.LBRRY_SE !== "어린이도서관") return null;
  const r = regionOf(x.RDNMADR);
  const lat = Number(x.LATITUDE), lng = Number(x.LONGITUDE);
  if (!r || !validLatLng(lat, lng)) return null;
  const parts = [
    hhmm(x.WEEKDAY_OPER_OPEN_HHMM, x.WEEKDAY_OPER_COLSE_HHMM) && `평일 ${hhmm(x.WEEKDAY_OPER_OPEN_HHMM, x.WEEKDAY_OPER_COLSE_HHMM)}`,
    hhmm(x.SAT_OPER_OPER_OPEN_HHMM, x.SAT_OPER_CLOSE_HHMM) && `토요일 ${hhmm(x.SAT_OPER_OPER_OPEN_HHMM, x.SAT_OPER_CLOSE_HHMM)}`,
    hhmm(x.HOLIDAY_OPER_OPEN_HHMM, x.HOLIDAY_CLOSE_OPEN_HHMM) && `공휴일 ${hhmm(x.HOLIDAY_OPER_OPEN_HHMM, x.HOLIDAY_CLOSE_OPEN_HHMM)}`,
  ].filter(Boolean);
  const kids = x.LBRRY_SE === "어린이도서관";
  return base(r, {
    id: `lb-${hashId(clean(x.LBRRY_NM) + clean(x.RDNMADR))}`,
    name: clean(x.LBRRY_NM),
    address: clean(x.RDNMADR),
    lat,
    lng,
    setting: "indoor",
    ages: null,
    agesText: null,
    fee: { free: true, text: "무료 (공공도서관 기본 이용)" },
    category: "library",
    hours: parts.length ? parts.join(" · ") : null,
    closedDays: clean(x.CLOSE_DAY) || null,
    reservation: { need: "no", note: "자료실은 예약 없이 들어가요. 프로그램은 따로 신청할 수 있어요." },
    homepage: url(x.HOMEPAGE_URL),
    summary: kids ? "어린이도서관이에요. 책 읽기와 쉬어 가기 좋은 실내 공공시설이에요." : `공공도서관이에요.${clean(x.OPER_INSTITUTION_NM) ? ` 운영은 ${clean(x.OPER_INSTITUTION_NM)}.` : ""}`,
    phone: clean(x.PHONE_NUMBER) || null,
    kids,
    size: Number(x.BULD_AR) || 0,
    source: "library",
    sourceUrl: SOURCES.library.url,
    lastVerified: day(x.REFERENCE_DATE),
  });
}

function won(n) {
  return `${Number(n).toLocaleString("ko-KR")}원`;
}
function fromMuseum(x) {
  const r = regionOf(x.RDNMADR || x.LNMADR);
  const lat = Number(x.LATITUDE), lng = Number(x.LONGITUDE);
  if (!r || !validLatLng(lat, lng)) return null;
  const child = clean(x.CHILD_CHRGE), adult = clean(x.ADULT_CHRGE), etc = clean(x.ETC_CHRGE_INFO);
  const num = (s) => (/^\d+$/.test(s) ? Number(s) : null);
  const c = num(child), a = num(adult);
  const unclear = /상이|별도|유료|변동/.test(etc);
  let free = null;
  if (c !== null && a !== null) free = c === 0 && a === 0 ? (unclear ? null : true) : false;
  const feeParts = [c !== null && (c === 0 ? "어린이 무료" : `어린이 ${won(c)}`), a !== null && (a === 0 ? "어른 무료" : `어른 ${won(a)}`), etc].filter(Boolean);
  const info = clean(x.FCLTY_INFO);
  const intro = clean(x.FCLTY_INTRCN);
  const first = intro ? (intro.match(/^.{10,90}?[다요]\./)?.[0] ?? (intro.length > 90 ? `${intro.slice(0, 88)}…` : intro)) : "";
  const hours = [
    hhmm(x.WEEKDAY_OPER_OPEN_HHMM, x.WEEKDAY_OPER_COLSE_HHMM) && `평일 ${hhmm(x.WEEKDAY_OPER_OPEN_HHMM, x.WEEKDAY_OPER_COLSE_HHMM)}`,
    hhmm(x.HOLIDAY_OPER_OPEN_HHMM, x.HOLIDAY_CLOSE_OPEN_HHMM) && `공휴일 ${hhmm(x.HOLIDAY_OPER_OPEN_HHMM, x.HOLIDAY_CLOSE_OPEN_HHMM)}`,
  ].filter(Boolean);
  const kind = /미술/.test(clean(x.FCLTY_NM)) ? "미술관" : "박물관";
  return base(r, {
    id: `ms-${hashId(clean(x.FCLTY_NM) + clean(x.RDNMADR || x.LNMADR))}`,
    name: clean(x.FCLTY_NM),
    address: clean(x.RDNMADR || x.LNMADR),
    lat,
    lng,
    setting: "indoor",
    ages: null,
    agesText: null,
    fee: { free, text: feeParts.length ? feeParts.join(" · ") : null },
    category: "museum",
    hours: hours.length ? hours.join(" · ") : null,
    closedDays: clean(x.RSTDE_INFO) || null,
    reservation: null,
    amenities: { nursingRoom: has(info, /수유/), diaperTable: has(info, /기저귀/), strollerAccess: has(info, /유모차/), parking: has(info, /주차/) },
    homepage: url(x.HOMEPAGE_URL),
    summary: first || `${clean(x.FCLTY_TYPE) ? `${clean(x.FCLTY_TYPE)} ` : ""}${kind}이에요.`,
    phone: clean(x.OPER_PHONE_NUMBER || x.PHONE_NUMBER) || null,
    public: /국립|공립/.test(clean(x.FCLTY_TYPE)),
    source: "museum",
    sourceUrl: SOURCES.museum.url,
    lastVerified: day(x.REFERENCE_DATE),
  });
}

const BIG_PARK = new Set(["근린공원", "수변공원", "체육공원", "문화공원", "역사공원", "도시농업공원"]);
function fromPark(x) {
  if (x.PARK_SE === "묘지공원") return null;
  const r = regionOf(x.RDNMADR || x.LNMADR);
  const lat = Number(x.LATITUDE), lng = Number(x.LONGITUDE);
  if (!r || !validLatLng(lat, lng)) return null;
  const play = clean(x.AMSMT_FCLTY).replace(/\s*,\s*/g, ", ");
  const conv = clean(x.CNVNNC_FCLTY);
  const area = Number(x.PARK_AR) || 0;
  return base(r, {
    id: `pk-${clean(x.MANAGE_NO) ? clean(x.MANAGE_NO).toLowerCase() : hashId(clean(x.PARK_NM) + clean(x.LNMADR))}`,
    name: clean(x.PARK_NM),
    address: clean(x.RDNMADR || x.LNMADR),
    lat,
    lng,
    setting: "outdoor",
    ages: null,
    agesText: null,
    fee: { free: null, text: null },
    category: "park",
    hours: null,
    closedDays: null,
    reservation: { need: "no", note: "늘 열려 있는 도시공원이에요." },
    amenities: { nursingRoom: null, diaperTable: null, strollerAccess: null, parking: has(conv, /주차/) },
    summary: `${clean(x.PARK_SE) || "도시공원"}이에요${area ? ` (면적 ${Math.round(area).toLocaleString("ko-KR")}㎡)` : ""}.${play ? ` 놀이시설: ${play}.` : ""}`,
    play: !!play,
    big: BIG_PARK.has(clean(x.PARK_SE)),
    size: area,
    source: "park",
    sourceUrl: SOURCES.park.url,
    lastVerified: day(x.REFERENCE_DATE),
  });
}

/** 지역마다 20곳까지: 키즈카페 → 어린이도서관 → 공공도서관(최대 4) → 박물관·미술관(최대 4) → 놀이시설 있는 큰 공원 순 */
export function pick(list) {
  const seen = new Set();
  const out = [];
  const add = (p) => {
    const key = p.name.replace(/\s/g, "");
    if (out.length >= PER_REGION || seen.has(key) || seen.has(p.id)) return;
    seen.add(key);
    seen.add(p.id);
    out.push(p);
  };
  const by = (cat) => list.filter((p) => p.category === cat);
  by("kidscafe").sort((a, b) => (b.fee.free === true) - (a.fee.free === true) || (a.setting === "outdoor") - (b.setting === "outdoor")).slice(0, 10).forEach(add);
  by("library").filter((p) => p.kids).forEach(add);
  by("library").filter((p) => !p.kids).sort((a, b) => /어린이/.test(b.name) - /어린이/.test(a.name) || b.size - a.size).slice(0, 4).forEach(add);
  by("museum").sort((a, b) => b.public - a.public || (b.fee.free === true) - (a.fee.free === true)).slice(0, 4).forEach(add);
  by("park").sort((a, b) => b.play * b.big - a.play * a.big || b.play - a.play || b.big - a.big || b.size - a.size).forEach(add);
  return out;
}

const STRIP = ["kids", "size", "public", "play", "big"];
function finalize(p) {
  const o = { ...p };
  for (const k of STRIP) delete o[k];
  return o;
}

async function main() {
  console.log("내려받는 중…");
  const [kids, libs, muses, parks] = await Promise.all([seoulSheet("OA-21716"), standard("15013109"), standard("15017323"), standard("15012890")]);
  console.log(`키즈카페 ${kids.length} · 도서관 ${libs.length} · 박물관 ${muses.length} · 공원 ${parks.length}`);
  const all = [...kids.map(fromKidscafe), ...libs.map(fromLibrary), ...muses.map(fromMuseum), ...parks.map(fromPark)].filter(Boolean);
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith(".json")) rmSync(join(OUT, f));
  const short = [];
  for (const r of regions) {
    const chosen = pick(all.filter((p) => p.sigungu === r.id)).map(finalize);
    if (chosen.length < 10) short.push(`${r.sigungu} ${chosen.length}곳`);
    writeFileSync(join(OUT, `${r.id}.json`), `[\n${chosen.map((p) => JSON.stringify(p)).join(",\n")}\n]\n`); // 한 줄에 한 곳: 주간 갱신 diff를 읽기 쉽게
  }
  writeFileSync(
    "src/data/places-meta.json",
    `${JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), sources: SOURCES, extra: [KIDS_RESERVE_SRC, KIDS_OUTDOOR_SRC] }, null, 2)}\n`,
  );
  console.log(`지역 ${regions.length}곳 저장. 10곳 미만: ${short.length ? short.join(", ") : "없음"}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/").replace(/^\/?/, "/")}` || process.argv[1]?.endsWith("fetch-places.mjs")) {
  main().catch((e) => {
    console.error("수집 실패 — 기존 파일을 그대로 둬요:", e.message);
    process.exit(1);
  });
}
