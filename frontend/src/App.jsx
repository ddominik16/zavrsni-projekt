import { useState } from "react";
import Overview from "./pages/Overview.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import Network from "./pages/Network.jsx";
import Analytics from "./pages/Analytics.jsx";
import useFetch from "./useFetch.js";

const PAGES = [
  { id: "pregled", label: "Pregled", Component: Overview },
  { id: "preporuke", label: "Preporuke", Component: Recommendations },
  { id: "mreza", label: "Mreža", Component: Network },
  { id: "analitika", label: "Analitika", Component: Analytics },
];

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function HealthPill() {
  const { data, error } = useFetch(
    () => fetch(API + "/api/health").then((r) => r.json()),
    []
  );

  const ok = data && data.database === "ok";
  const cls = error || !ok ? "pill__led pill__led--bad" : "pill__led pill__led--ok";
  const tekst = error || !ok ? "baza nedostupna" : "bolt://localhost:7687";

  // Na uskim ekranima ostaje samo lampica, inace traka ne stane uz izbornik.
  return (
    <span className="pill" title={tekst}>
      <span className={data || error ? cls : "pill__led"} />
      <span className="pill__txt">{tekst}</span>
    </span>
  );
}

export default function App() {
  const [active, setActive] = useState("pregled");
  const current = PAGES.find((p) => p.id === active) || PAGES[0];
  const Page = current.Component;

  return (
    <>
      <div className="rail">
        <div className="rail__mark">Filmski&nbsp;Graf</div>
        <div className="rail__dot" />
        <div className="rail__meta">Neo4j · GDS 2.x</div>
      </div>

      <div className="shell">
        <div className="topbar">
          <div className="topbar__inner">
            <div className="nav" role="tablist" aria-label="Sekcije">
              {PAGES.map((p) => (
                <button
                  key={p.id}
                  className="nav__btn"
                  role="tab"
                  aria-selected={p.id === active}
                  onClick={() => setActive(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="topbar__right">
              <HealthPill />
            </div>
          </div>
        </div>

        <div className="wrap">
          <Page />
        </div>
      </div>
    </>
  );
}
