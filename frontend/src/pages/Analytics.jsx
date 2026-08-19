import { useState } from "react";
import { getCentrality, getCommunities } from "../api.js";
import useFetch from "../useFetch.js";
import Panel from "../components/Panel.jsx";
import RankList from "../components/RankList.jsx";
import { Loading, ErrorBox } from "../components/States.jsx";
import { formatNumber, formatDecimal } from "../format.js";

const MEASURES = [
  { id: "degree", label: "Stupanj" },
  { id: "pageRank", label: "PageRank" },
  { id: "betweenness", label: "Betweenness" },
  { id: "closeness", label: "Blizina" },
];

export default function Analytics() {
  const [measure, setMeasure] = useState("pageRank");

  const table = useFetch(() => getCentrality(measure, 20), [measure]);
  const bridges = useFetch(() => getCentrality("betweenness", 8), []);
  const communities = useFetch(() => getCommunities(10), []);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Analiza mreže</div>
          <h1 className="head__title">Analitika</h1>
        </div>
        <p className="head__note">
          Četiri mjere centralnosti nad istim grafom daju četiri različita
          odgovora. Klik na zaglavlje mijenja sortiranje.
        </p>
      </div>

      <Panel title="Centralnost" sub="collaborationGraph" flush>
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Glumac</th>
                {MEASURES.map((m) => (
                  <th
                    key={m.id}
                    className={m.id === measure ? "is-sorted" : ""}
                    aria-sort={m.id === measure ? "descending" : "none"}
                  >
                    <button onClick={() => setMeasure(m.id)}>{m.label}</button>
                  </th>
                ))}
                <th>Zajednica</th>
              </tr>
            </thead>
            <tbody>
              {table.loading ? (
                <tr>
                  <td colSpan={6}>
                    <Loading />
                  </td>
                </tr>
              ) : table.error ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorBox message={table.error} />
                  </td>
                </tr>
              ) : (
                table.data.map((p) => (
                  <tr key={p.personId}>
                    <td>{p.name}</td>
                    <td>{formatNumber(p.degree)}</td>
                    <td>{formatDecimal(p.pageRank, 2)}</td>
                    <td className={p.betweenness > 500000 ? "hi" : ""}>
                      {formatNumber(p.betweenness)}
                    </td>
                    <td>{formatDecimal(p.closeness, 4)}</td>
                    <td>{p.communityId ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="note">
        Betweenness ne koristi nikakav podatak o nacionalnosti ili jeziku, a na
        vrhu ljestvice zavrsavaju gotovo iskljucivo glumci s karijerom u dvjema
        ili vise nacionalnih kinematografija. Imena koja dominiraju stupnjem
        nalaze se ispod njih, unatoc dvostruko do trostruko vecem broju
        suradnika.
      </div>

      <div className="grid grid--2">
        <Panel title="Posrednici" sub="betweenness">
          {bridges.loading ? (
            <Loading />
          ) : bridges.error ? (
            <ErrorBox message={bridges.error} />
          ) : (
            <RankList
              brick
              items={bridges.data.map((p) => ({
                id: p.personId,
                label: p.name,
                value: p.betweenness,
              }))}
            />
          )}
        </Panel>

        <Panel title="Zajednice" sub="Louvain" flush>
          <div className="tblwrap">
            <table className="tbl" style={{ minWidth: 380 }}>
              <thead>
                <tr>
                  <th>Zajednica</th>
                  <th>Članova</th>
                  <th>Filmova</th>
                  <th>Medijan</th>
                </tr>
              </thead>
              <tbody>
                {communities.loading ? (
                  <tr>
                    <td colSpan={4}>
                      <Loading />
                    </td>
                  </tr>
                ) : communities.error ? (
                  <tr>
                    <td colSpan={4}>
                      <ErrorBox message={communities.error} />
                    </td>
                  </tr>
                ) : (
                  communities.data.map((c) => (
                    <tr key={c.communityId}>
                      <td>{c.communityId}</td>
                      <td>{formatNumber(c.members)}</td>
                      <td>{formatNumber(c.films)}</td>
                      <td>{c.medianYear || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
