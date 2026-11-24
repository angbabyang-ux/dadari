// 데이터 출처·확인일·계산 방법·면책 고지. 정책 JSON에서 자동으로 만든다
import { useState } from "react";
import { benefits, leaveRules, reference, regions } from "../data";
import { formatWon } from "../engine/money";
import { CATEGORY_LABEL, LEVEL_LABEL } from "./result/aggregate";
import { StatusBadge } from "./result/parts";
import { fetchedAt, sources as placeSources } from "../data/places-meta.json";

export function DataPage() {
  const [q, setQ] = useState("");
  const list = benefits.filter((b) => !q || `${b.name} ${b.region?.sigungu ?? ""} ${b.region?.sido ?? ""}`.includes(q));
  const counts = { confirmed: 0, "needs-check": 0, proposed: 0, ended: 0 } as Record<string, number>;
  for (const b of benefits) counts[b.status]!++;
  const latest = benefits.map((b) => b.lastVerified).sort().at(-1);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pb-24">
      <h1 className="font-serif text-2xl md:text-4xl font-semibold pt-8 pb-3 rule-b">데이터와 계산 방법</h1>

      <section className="grid md:grid-cols-12 gap-x-8 pt-6">
        <div className="md:col-span-7 space-y-3">
          <p>이 사이트는 공식 누리집과 보도자료에서 확인한 숫자만 써요. 확인하지 못한 숫자는 만들지 않고 ‘확인 필요’로 표시해요.</p>
          <p>
            모든 계산은 이 브라우저 안에서 해요. 입력한 출생일·소득·주소는 어떤 서버로도 보내지 않아요. 결과 주소에 입력값이 담겨 있으니 공유할 때 참고해 주세요.
          </p>
          <p className="font-semibold">참고용 계산이에요. 실제 지급액은 신청 기관의 심사로 정해져요.</p>
        </div>
        <dl className="md:col-span-5 grid grid-cols-2 gap-y-2 mt-6 md:mt-0 rule-t pt-3 text-sm num">
          <dt className="text-ink-2">항목 수</dt>
          <dd>{benefits.length}개</dd>
          <dt className="text-ink-2">확정</dt>
          <dd>{counts.confirmed}개</dd>
          <dt className="text-ink-2">확인 필요</dt>
          <dd>{counts["needs-check"]}개</dd>
          <dt className="text-ink-2">정부안</dt>
          <dd>{counts.proposed}개</dd>
          <dt className="text-ink-2">종료</dt>
          <dd>{counts.ended}개</dd>
          <dt className="text-ink-2">마지막 확인</dt>
          <dd>{latest}</dd>
        </dl>
      </section>

      <h2 className="font-serif text-xl font-semibold pt-10 pb-2 rule-b border-ink">계산 방법</h2>
      <ul className="list-disc pl-5 space-y-2 pt-3 text-[15px]">
        <li>계산 범위는 출생월부터 초등학교 입학 직전 2월(출생연도 + 7년)까지예요. 조기·유예 입학은 따지지 않아요.</li>
        <li>나이는 생후 개월 수로 셈해요. 출생월이 0개월이에요.</li>
        <li>한 번에 받는 돈은 지급 예상 월에 넣어요. 지급 시점을 알 수 없으면 출생월 다음 달에 넣고 ‘가정’이라고 적어요.</li>
        <li>
          어린이집에 다니면 부모급여에서 보육료({reference.childcareFee.year}년 0세반 {formatWon(reference.childcareFee.age0)}, 1세반 {formatWon(reference.childcareFee.age1)})를 빼고 차액만 현금으로 셈해요.
        </li>
        <li>
          육아휴직 급여는 통상임금에 지급률을 곱하고 상한·하한({formatWon(leaveRules.floor)})을 적용해요. 두 부모 모두 아이 생후 {leaveRules.sixPlusSix.withinChildMonths}개월 안에 휴직을 시작하면 6+6 특례로 첫 6개월 상한이{" "}
          {leaveRules.sixPlusSix.caps.map((c) => Math.round(c / 10000)).join("·")}만 원이 돼요.
        </li>
        <li>거주기간이 모자라면 조건을 채우는 달로 지급을 미뤄요. 조건상 받을 수 없으면 빼고 이유를 보여줘요.</li>
        <li>소득 기준은 지급 연도의 기준 중위소득으로 따져요. 다태아는 아이마다 출생순위를 따로 셈해요.</li>
        <li>정부안(국회 의결 전)은 ‘정부안 포함’을 켰을 때만 더하고, 빗금으로 구분해요.</li>
      </ul>

      <h2 className="font-serif text-xl font-semibold pt-10 pb-2 rule-b border-ink">모든 항목</h2>
      <div className="py-3">
        <label htmlFor="q" className="sr-only">
          항목 검색
        </label>
        <input id="q" className="field max-w-80" placeholder="제도나 지역 이름으로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="rule-b text-left text-ink-2">
              <th scope="col" className="py-2 font-medium">제도</th>
              <th scope="col" className="py-2 font-medium">지역</th>
              <th scope="col" className="py-2 font-medium">형태</th>
              <th scope="col" className="py-2 font-medium">상태</th>
              <th scope="col" className="py-2 font-medium">확인일</th>
              <th scope="col" className="py-2 font-medium">출처</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="rule-b align-top">
                <th scope="row" className="py-2 pr-3 text-left font-semibold">{b.name}</th>
                <td className="py-2 pr-3">{b.region ? `${b.region.sido} ${b.region.sigungu ?? ""}` : LEVEL_LABEL[b.level]}</td>
                <td className="py-2 pr-3">{CATEGORY_LABEL[b.category]}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={b.status} />
                </td>
                <td className="py-2 pr-3 num whitespace-nowrap">{b.lastVerified}</td>
                <td className="py-2">
                  {b.sourceUrl.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="block truncate max-w-56 py-1">
                      {new URL(u).hostname.replace(/^www\./, "")}
                    </a>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="places" className="font-serif text-xl font-semibold pt-10 pb-2 rule-b border-ink scroll-mt-4">
        아이랑 갈 곳 데이터
      </h2>
      <div className="grid md:grid-cols-12 gap-x-8 pt-3 text-sm">
        <div className="md:col-span-7 space-y-2">
          <p>아래 공공데이터를 매주 자동으로 다시 받아 지역마다 20곳까지 골라요. 서울형 키즈카페, 어린이도서관, 공공도서관, 박물관·미술관, 놀이시설이 있는 큰 공원 순서예요.</p>
          <p>카드의 확인일은 각 공공데이터가 밝힌 기준일이에요. 수유실·기저귀 교환대·유모차 정보는 공공데이터에 거의 없어서 대부분 ‘확인 필요’로 보여요.</p>
          <p>
            공공도서관은 기본 이용(열람·대출)이 무료라 무료로 표시해요. 서울형 키즈카페의 예약 방식은{" "}
            <a href="https://mediahub.seoul.go.kr/archives/2008564" target="_blank" rel="noreferrer">
              서울시 공식 소식
            </a>
            을 따랐어요. 블로그 후기 같은 비공식 정보는 쓰지 않아요.
          </p>
          <p className="num text-ink-2">마지막 수집 {fetchedAt}</p>
        </div>
        <ul className="md:col-span-5 mt-4 md:mt-0">
          {Object.values(placeSources).map((src) => (
            <li key={src.url} className="py-2 rule-b">
              <a href={src.url} target="_blank" rel="noreferrer" className="font-medium">
                {src.name}
              </a>
              <span className="block text-ink-2">
                {src.org} · {src.license}
              </span>
            </li>
          ))}
          <li className="py-2 rule-b">
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="font-medium">
              지도 © OpenStreetMap 기여자
            </a>
            <span className="block text-ink-2">ODbL · 지도 보기를 누를 때만 불러와요</span>
          </li>
        </ul>
      </div>

      <h2 id="report" className="font-serif text-xl font-semibold pt-10 pb-2 rule-b border-ink scroll-mt-4">
        정보가 달라졌을 때
      </h2>
      <p className="pt-3 text-sm max-w-2xl">
        장소 카드의 ‘정보가 달라졌어요’를 누르면 이 사이트의 GitHub 저장소에 제보 글을 남길 수 있어요. 공식 누리집이나 전화로 확인한 내용을 적어 주시면 공공데이터와 함께 다시 확인해 반영해요. 개인정보는 적지 말아 주세요.
      </p>

      <h2 className="font-serif text-xl font-semibold pt-10 pb-2 rule-b border-ink">시·군·구 현금 지원 확인 현황</h2>
      <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-x-8 text-sm pt-2">
        {regions.sigungu.map((r) => (
          <li key={r.id} className="py-1.5 rule-b flex justify-between gap-2">
            <span>
              {r.sido === "서울특별시" ? "서울" : "경기"} {r.sigungu}
            </span>
            <span className={r.cashGrant === "unknown" ? "text-accent" : "text-ink-2"}>{{ has: "지원 있음", none: "없음", unknown: "확인 필요" }[r.cashGrant]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
