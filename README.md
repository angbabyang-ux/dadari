# 다달이

아이가 태어난 달부터 초등학교 입학 직전 2월까지, 한 가정이 매달 받을 수 있는 출산·육아 지원금을 거주지(시·군·구)와 육아휴직 계획까지 반영해 달력처럼 보여주는 계산기예요.

- 공개 주소: https://<GitHub 사용자 이름>.github.io/dadari/ (배포 후 채워 넣기)
- 서울 25개 구·경기 31개 시·군은 자체 지원까지, 그 밖의 지역은 국가와 시·도 지원만 계산해요.
- 모든 계산은 브라우저 안에서 해요. 입력값은 어떤 서버로도 보내지 않아요.

## 로컬에서 실행하기

Node.js 24 이상이 필요해요.

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173/dadari/)
npm test           # 데이터 검증 + 계산 엔진 단위 테스트 (Vitest)
npm run build      # 타입 검사 → 빌드 → 경로·지역별 정적 HTML, sitemap.xml 생성
npm run preview    # 빌드 결과 미리보기 (http://localhost:4173/dadari/)
npm run test:e2e   # Playwright e2e (처음 한 번: npx playwright install chromium)
```

## 데이터 갱신 방법

정책 수치는 코드에 없고 모두 `src/data/*.json`에 있어요. 화면과 `/data` 페이지는 이 파일에서 자동으로 만들어져요.

| 파일 | 내용 |
|---|---|
| `national.json` | 국가 지원 (첫만남이용권, 부모급여, 아동수당, 정부안 등) |
| `seoul.json`, `seoul-gu.json` | 서울시, 서울 25개 구 |
| `gyeonggi.json` | 경기도, 경기 31개 시·군 |
| `regions.json` | 시·도/시·군·구 목록, 아동수당 지역 구분, 자체 현금 지원 확인 상태 |
| `leave-rules.json` | 육아휴직 급여 지급률·상한·하한, 6+6 상한 |
| `reference.json` | 기준 중위소득(연도별), 보육료 단가 |
| `places/<지역id>.json` | 아이랑 갈 곳 (자동 수집, 손으로 고치지 않음) |
| `places-meta.json`, `places-index.json` | 장소 데이터 출처·수집일, 지역별 개수·추천 |

바꾸는 순서는 이래요.

1. 해당 항목의 금액·조건을 고치고 `lastVerified`를 확인한 날짜로, `sourceUrl`에 근거 주소를 넣어요.
2. 상태를 맞춰요. `confirmed` 확정 · `proposed` 정부안 · `needs-check` 확인 필요 · `ended` 종료.
   - 국회에서 정부안이 의결되면 `status`만 `confirmed`로 바꾸면 돼요.
3. `npm test`를 돌려요. 스키마(zod)와 무결성 검사(출처 존재, id 중복, 분할 합계 등)를 통과해야 배포돼요.
4. 결정과 출처 간 불일치는 `context-notes.md`에 적어요.

새 지역 혜택은 `schedule.type`으로 지급 방식을 고르면 돼요. `lumpSum`은 일시금·분할, `monthly`는 월 정액, `perLeaveMonth`는 휴직 월마다, `classAge`는 유아 학급 연령별, `info`는 금액 없는 안내 카드예요. 자세한 필드는 `src/data/schema.ts`의 주석을 봐 주세요.

### 아이랑 갈 곳 데이터

`node scripts/fetch-places.mjs`가 공공데이터(서울형 키즈카페, 전국 도서관·박물관미술관·도시공원 표준데이터)를 받아 지역마다 20곳까지 골라 저장해요. 인증키가 필요 없어서 GitHub Secrets도 필요 없어요. `update-places.yml`이 매주 월요일 새벽에 같은 일을 하고, 바뀐 게 있으면 커밋한 뒤 배포를 다시 돌려요. 하나라도 받지 못하면 기존 파일을 그대로 둬요.

## 데이터 출처 정책

- 공식 누리집·보도자료·자치법규를 우선해요. 언론·정리 사이트는 공식 자료와 대조할 때만 써요.
- 확인할 수 없는 숫자는 만들지 않아요. 금액을 모르면 ‘확인 필요’ 카드로 공식 확인 링크만 보여줘요.
- 출처끼리 다르면 최신 자료 값을 쓰고 `needs-check`로 표시해요. 어느 값도 고를 수 없으면 합계에서 빼요.
- 결과는 참고용이에요. 실제 지급액은 신청 기관의 심사로 정해져요.

## 구조

```
src/data/        정책 JSON, zod 스키마
src/engine/      순수 함수 계산 엔진 (computeTimeline, 육아휴직 급여, 금액 표기)
src/state/       URL 쿼리 ↔ 입력값
src/ui/          화면 (입력, 결과, 비교, 2027 변화, 데이터, places/ 아이랑 갈 곳)
src/places/      장소 필터·경로·지연 로딩·제목
scripts/         빌드 후 정적 HTML·sitemap 생성, 장소 데이터 수집
tests/unit       Vitest (지시서 테스트 T1~T15 포함)
tests/e2e        Playwright
```

## 배포

`main`에 푸시하면 GitHub Actions가 `npm ci → npm test → npm run build → e2e → GitHub Pages 배포` 순서로 돌려요. 테스트가 하나라도 실패하면 배포하지 않아요. 저장소 이름을 `dadari`가 아닌 다른 이름으로 하면 `vite.config.ts`의 `base`와 `scripts/prerender.mjs`의 `BASE`를 같이 바꿔 주세요.
