// 앱 뼈대: 머리글·라우팅·바닥글
import { useMemo, useState } from "react";
import { hrefFor, navigate, useLocation, type Route } from "../router";
import { draftFromParams, isComplete } from "../state/url";
import { ChangesPage } from "./ChangesPage";
import { ComparePage } from "./ComparePage";
import { DataPage } from "./DataPage";
import { ResultPage } from "./result/ResultPage";
import { Wizard } from "./Wizard";

const NAV: { route: Route; label: string }[] = [
  { route: "home", label: "계산" },
  { route: "compare", label: "지역 비교" },
  { route: "changes", label: "2027 변화" },
  { route: "data", label: "데이터" },
];

export function App() {
  const { route, params } = useLocation();
  const query = params.toString();
  const draft = useMemo(() => draftFromParams(new URLSearchParams(query)), [query]);
  const complete = isComplete(draft);

  let page;
  if (route === "result" || route === "compare") {
    page = complete ? route === "result" ? <ResultPage input={draft} params={params} /> : <ComparePage input={draft} params={params} /> : <EmptyState />;
  } else if (route === "changes") page = <ChangesPage />;
  else if (route === "data") page = <DataPage />;
  else page = <Wizard draft={draft} />;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:p-2">
        본문으로 건너뛰기
      </a>
      <header className="rule-b no-print">
        <div className="mx-auto max-w-6xl px-4 md:px-8 flex items-center gap-4 h-14">
          <a href={hrefFor("home", complete ? query : undefined)} onClick={(e) => (e.preventDefault(), navigate("home", complete ? query : undefined))} className="font-serif text-xl font-bold no-underline">
            다달이
          </a>
          <nav aria-label="주 메뉴" className="flex-1 overflow-x-auto">
            <ul className="flex gap-4 text-sm whitespace-nowrap">
              {NAV.slice(1).map((n) => {
                const q = n.route === "compare" && complete ? query : undefined;
                return (
                  <li key={n.route}>
                    <a
                      href={hrefFor(n.route, q)}
                      onClick={(e) => (e.preventDefault(), navigate(n.route, q))}
                      aria-current={route === n.route ? "page" : undefined}
                      className={`no-underline py-4 ${route === n.route ? "font-semibold border-b-2 border-accent" : "text-ink-2"}`}
                    >
                      {n.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main id="main">{page}</main>
      <footer className="rule-t mt-8">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-8 text-sm text-ink-2 space-y-2">
          <p>입력한 정보는 서버로 보내지 않아요. 모든 계산은 이 브라우저 안에서 해요.</p>
          <p>
            참고용 계산이에요. 실제 지급액은 신청 기관의 심사로 정해져요.{" "}
            <a href={hrefFor("data")} onClick={(e) => (e.preventDefault(), navigate("data"))}>
              데이터 출처와 계산 방법
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-16">
      <h1 className="font-serif text-2xl font-semibold">계산할 정보가 아직 없어요.</h1>
      <p className="mt-2 text-ink-2">출생일과 사는 곳만 넣어도 결과를 볼 수 있어요.</p>
      <a className="btn btn-primary mt-6" href={hrefFor("home")} onClick={(e) => (e.preventDefault(), navigate("home"))}>
        입력하러 가기
      </a>
    </div>
  );
}

function ThemeToggle() {
  const read = () => {
    try {
      return localStorage.getItem("theme") ?? "auto";
    } catch {
      return "auto";
    }
  };
  const [theme, setTheme] = useState(read);
  const next = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
  const label = { auto: "화면 모드 자동", dark: "어두운 화면", light: "밝은 화면" }[theme];
  return (
    <button
      type="button"
      className="text-sm text-ink-2 underline underline-offset-4 shrink-0"
      onClick={() => {
        setTheme(next);
        if (next === "auto") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          /* 저장 실패는 무시 */
        }
      }}
      aria-label={`${label}. 눌러서 바꾸기`}
    >
      {{ auto: "자동", dark: "밤", light: "낮" }[theme]}
    </button>
  );
}
