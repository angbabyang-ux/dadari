// 공공데이터(서울형 키즈카페, 전국 도서관·박물관미술관·도시공원 표준데이터)를 받아 지역별 「아이랑 가볼만한 곳」 JSON을 만든다
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
    fid: clean(x.fclty_id),
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
    reservation: { need: "no", note: "입장 예약이 필요 없는 도시공원이에요. 운영 시간은 공원마다 달라요." },
    amenities: { nursingRoom: null, diaperTable: null, strollerAccess: null, parking: has(conv, /주차/) },
    summary: `${clean(x.PARK_SE) || "도시공원"}이에요${area ? ` (면적 ${Math.round(area).toLocaleString("ko-KR")}㎡)` : ""}.${play ? ` 놀이시설: ${play}.` : ""}`,
    phone: clean(x.PHONE_NUMBER) || null,
    manager: clean(x.INSTITUTION_NM) || null,
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

/* ───── 보강: 공식 페이지·주변 공공데이터로 빈칸 채우기 ───── */
export const EXTRA_SOURCES = {
  icare: { name: "서울시 우리동네키움포털 서울형 키즈카페 시설 안내", url: "https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeList.do", org: "서울특별시", license: "공식 누리집 안내" },
  parking: { name: "전국주차장정보표준데이터", url: "https://www.data.go.kr/data/15012896/standard.do", org: "공공데이터포털", license: "공공데이터포털 이용정책" },
};
const icareUrl = (fid) => `https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=${encodeURIComponent(fid)}&q_fcltyStle=`;

/** 두 좌표 사이 거리(m) */
export function distM(a, b) {
  const R = 6371000, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** 키움포털 시설 페이지에서 이용료·운영 회차·주차·휴관일을 읽는다 (못 읽으면 그 항목은 비워 둔다) */
export function parseIcare(html) {
  const t = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
  const plain = t.replace(/<[^>]+>/g, "|").replace(/&nbsp;|&#160;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").replace(/(\|\s*)+/g, "|");
  const after = (key, len = 900) => {
    const i = plain.indexOf(key);
    return i < 0 ? "" : plain.slice(i + key.length, i + key.length + len);
  };
  const segs = (s) => s.split("|").map((x) => x.replace(/^[\s\-○★※*]+/, "").replace(/[\s★※*:]+$/, "").trim()).filter(Boolean);
  // 이용료: '이용료' 제목 뒤 첫 '원'이 든 문장
  let fee = null;
  const feeSeg = segs(after("|이용료|", 600)).find((x) => /\d[\d,]*\s*원|무료/.test(x));
  if (feeSeg) fee = feeSeg.replace(/^\((개인|단체)\)\s*/, "").replace(/^개인\s*/, "").slice(0, 90);
  // 운영 회차: '운영시간' 제목 뒤 시간 범위들
  const block = after("|운영시간|", 1600);
  // "1회차|10:00 ~ 12:00"처럼 회차 번호가 붙은 시간만 쓴다 (점심·정비 시간이 섞이지 않게)
  const hhmm2 = (x) => x.padStart(5, "0");
  const times = [...new Set([...block.matchAll(/\d+\s*회차\s*\|?\s*(\d{1,2}:\d{2})\s*[~-]\s*(\d{1,2}:\d{2})/g)].map((m) => `${hhmm2(m[1])}~${hhmm2(m[2])}`))].sort();
  const hours = times.length ? `회차별 이용 ${times.slice(0, 6).join(" · ")}${times.length > 6 ? " 외" : ""} (요일마다 다를 수 있어요)` : null;
  // 주차: '주차'로 시작하는 문장 하나만 (제목만 있으면 바로 다음 문장)
  let parking = null;
  const all = segs(plain);
  const k = all.findIndex((x) => /^주차/.test(x) && !/^주차(장)?\s*(이용)?\s*안내$/.test(x) && x.length > 6);
  const h = all.findIndex((x) => /^주차(장)?\s*(이용)?\s*안내\s*$/.test(x));
  const HEAD = /^(이용료|온라인|예약|이용정원|이용연령|입장료|자세한|※|공지)/;
  let pick2 = null;
  if (k >= 0 && (h < 0 || k < h)) pick2 = all[k];
  else if (h >= 0) {
    // 제목 다음 조각들을 문장 하나 길이까지 잇는다 ("길 건너편|경향교회 지하주차장|(2시간 무료 제공)")
    const parts = [];
    for (const x of all.slice(h + 1, h + 6)) {
      if (HEAD.test(x) || parts.join(" ").length > 90) break;
      parts.push(x);
    }
    pick2 = parts.join(" ") || null;
  }
  if (pick2 && !HEAD.test(pick2)) parking = pick2.split(/(?<=[.다요])\s+(?=\d+\.|[가-힣])/)[0].slice(0, 120);
  // 휴관일
  const closed = segs(after("|휴관일|", 120))[0] ?? null;
  return { fee, hours, parking, closed: closed && closed.length < 60 ? closed : null };
}

async function enrichKidscafes(list) {
  const kids = list.filter((p) => p.category === "kidscafe" && p.fid);
  let ok = 0;
  for (let i = 0; i < kids.length; i += 4) {
    await Promise.all(
      kids.slice(i, i + 4).map(async (p) => {
        const u = icareUrl(p.fid);
        try {
          const res = await fetch(u, { headers: UA });
          if (!res.ok) return;
          const info = parseIcare(await res.text());
          p.homepage = u;
          if (info.fee) p.fee = { free: p.fee.free, text: info.fee };
          if (info.hours) p.hours = info.hours;
          if (info.closed) p.closedDays = info.closed;
          if (info.parking) {
            // 분명할 때만 있다/없다로 적고, 애매하면 안내 문구만 보여 준다
            const no = /(주차|시설|공간)\s*(장|시설|공간)?\s*(이|가|은)?\s*없|주차\s*(가|는)?\s*불가|주차 불가|이용 금지/.test(info.parking);
            const yes = /무료|가능|이용\s*가능|주차장 이용|대까지/.test(info.parking) && !no && !/공영주차장|인근|맞은편|근처/.test(info.parking);
            p.amenities.parking = no ? false : yes ? true : null;
            p.parkingNote = info.parking;
          }
          p.detailSource = EXTRA_SOURCES.icare.url;
          ok++;
        } catch {
          /* 이 시설은 보강 없이 둔다 */
        }
      }),
    );
  }
  return ok;
}

/** 300m 안 가장 가까운 공영주차장 (공중화장실 표준데이터는 기저귀 교환대 칸이 모두 비어 있어 쓰지 않는다) */
function enrichNearby(list, lots) {
  const near = (arr, p, max) => {
    let best = null;
    for (const x of arr) {
      if (Math.abs(x.lat - p.lat) > 0.004 || Math.abs(x.lng - p.lng) > 0.005) continue;
      const d = distM(p, x);
      if (d <= max && (!best || d < best.d)) best = { ...x, d };
    }
    return best;
  };
  for (const p of list) {
    const l = near(lots, p, 300);
    if (l) p.nearbyParking = { name: l.name, m: l.d, spaces: l.spaces, fee: l.fee };
  }
}

function parkingRows(rows) {
  return rows
    .map((x) => {
      const basic = clean(x.BASIC_TIME), basicFee = clean(x.BASIC_CHARGE);
      const kind = clean(x.PARKINGCHRGE_INFO);
      const fee = kind === "무료" ? "무료" : basic && basicFee && basicFee !== "0" ? `기본 ${basic}분 ${Number(basicFee).toLocaleString("ko-KR")}원` : kind || null;
      return { name: clean(x.PRKPLCE_NM), spaces: Number(x.PRKCMPRT) || null, fee, lat: Number(x.LATITUDE), lng: Number(x.LONGITUDE) };
    })
    .filter((x) => x.name && validLatLng(x.lat, x.lng));
}

const STRIP = ["kids", "size", "public", "play", "big", "fid"];
function finalize(p) {
  const o = { ...p };
  for (const k of STRIP) delete o[k];
  return o;
}

async function main() {
  console.log("내려받는 중…");
  const [kids, libs, muses, parks, lotsRaw] = await Promise.all([seoulSheet("OA-21716"), standard("15013109"), standard("15017323"), standard("15012890"), standard("15012896")]);
  const lots = parkingRows(lotsRaw);
  console.log(`키즈카페 ${kids.length} · 도서관 ${libs.length} · 박물관 ${muses.length} · 공원 ${parks.length} · 주차장 ${lots.length}`);
  const all = [...kids.map(fromKidscafe), ...libs.map(fromLibrary), ...muses.map(fromMuseum), ...parks.map(fromPark)].filter(Boolean);
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith(".json")) rmSync(join(OUT, f));
  const short = [];
  const counts = {};
  const byRegion = {};
  // 지역마다 고른 뒤, 고른 곳만 보강한다 (키움포털 페이지 요청을 줄이기 위해)
  const raw = {};
  for (const r of regions) raw[r.id] = pick(all.filter((p) => p.sigungu === r.id));
  const chosenAll = Object.values(raw).flat();
  const enriched = await enrichKidscafes(chosenAll);
  enrichNearby(chosenAll, lots);
  console.log(`키즈카페 공식 페이지 보강 ${enriched}/${chosenAll.filter((p) => p.category === "kidscafe").length} · 공영주차장 근처 ${chosenAll.filter((p) => p.nearbyParking).length}`);
  for (const r of regions) {
    const chosen = raw[r.id].map(finalize);
    if (chosen.length < 10) short.push(`${r.sigungu} ${chosen.length}곳`);
    byRegion[r.id] = chosen;
    counts[r.id] = { total: chosen.length, indoor: chosen.filter((p) => p.setting !== "outdoor").length, free: chosen.filter((p) => p.fee.free === true).length };
    writeFileSync(join(OUT, `${r.id}.json`), `[\n${chosen.map((p) => JSON.stringify(p)).join(",\n")}\n]\n`); // 한 줄에 한 곳: 주간 갱신 diff를 읽기 쉽게
  }
  // 시·도 첫 화면 추천: 무료 실내 공공시설(무료 키즈카페 → 어린이도서관 → 무료 공립 박물관) 가운데 지역마다 1곳, 6곳까지
  const rank = (p) => (p.category === "kidscafe" ? 0 : p.category === "library" ? 1 : 2);
  const picks = {};
  for (const sido of ["seoul", "gyeonggi"]) {
    const cands = regions
      .filter((r) => SIDO_ID[r.sido] === sido)
      .map((r) => byRegion[r.id].filter((p) => p.fee.free === true && p.setting === "indoor" && (p.category !== "library" || /어린이/.test(p.name))).sort((a, b) => rank(a) - rank(b))[0])
      .filter(Boolean)
      .sort((a, b) => rank(a) - rank(b) || a.sigungu.localeCompare(b.sigungu));
    picks[sido] = cands.slice(0, 6);
  }
  // 출처(데이터 페이지가 첫 화면 묶음에서 씀)와 색인(아이랑 가볼만한 곳 화면 묶음에서만 씀)을 나눠 저장한다
  writeFileSync("src/data/places-meta.json", `${JSON.stringify({ fetchedAt: new Date().toISOString().slice(0, 10), sources: { ...SOURCES, ...EXTRA_SOURCES }, extra: [KIDS_RESERVE_SRC, KIDS_OUTDOOR_SRC] }, null, 1)}\n`);
  writeFileSync("src/data/places-index.json", `${JSON.stringify({ counts, picks }, null, 1)}\n`);
  console.log(`지역 ${regions.length}곳 저장. 10곳 미만: ${short.length ? short.join(", ") : "없음"}`);
}

if (process.argv[1]?.endsWith("fetch-places.mjs")) {
  main().catch((e) => {
    console.error("수집 실패 — 기존 파일을 그대로 둬요:", e.message);
    process.exit(1);
  });
}
