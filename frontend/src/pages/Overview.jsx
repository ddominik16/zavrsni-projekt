import { useMemo } from "react";
import { getStats, getCommunities, getCentrality, getTopPairs } from "../api.js";
import useFetch from "../useFetch.js";
import Panel from "../components/Panel.jsx";
import RankList from "../components/RankList.jsx";
import { Loading, ErrorBox } from "../components/States.jsx";
import { buildColorMap, colorFor } from "../colors.js";
import { formatNumber } from "../format.js";

export default function Overview() {
  const stats = useFetch(() => getStats(), []);
  const communities = useFetch(() => getCommunities(8), []);
  const degree = useFetch(() => getCentrality("degree", 8), []);
  const pairs = useFetch(() => getTopPairs(3), []);

  const colorMap = useMemo(() => {
    if (!communities.data) return new Map();
    return buildColorMap(communities.data.map((c) => c.communityId));
  }, [communities.data]);

  if (stats.error) return <ErrorBox message={stats.error} />;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Nadzorna ploča</div>
          <h1 className="head__title">
            Mreža filmske
            <br />
            suradnje
          </h1>
        </div>
        <p className="head__note">
          Graf izgrađen iz filtriranog IMDb skupa. Veze suradnje izvedene su iz
          zajedničkih pojavljivanja u filmovima.
        </p>
      </div>

      {stats.loading ? (
        <Loading what="Ucitavam statistiku" />
      ) : (
        <div className="figures">
          <Figure n={stats.data.persons} label="Osoba" />
          <Figure n={stats.data.movies} label="Filmova" />
          <Figure n={stats.data.collabs} label="Veza suradnje" />
          <Figure n={stats.data.communities} label="Zajednica" accent />
        </div>
      )}

      <div className="grid grid--2">
        <Panel title="Najveće zajednice" sub="Louvain">
          {communities.loading ? (
            <Loading />
          ) : communities.error ? (
            <ErrorBox message={communities.error} />
          ) : (
            communities.data.map((c) => (
              <div className="comm__row" key={c.communityId}>
                <span
                  className="comm__swatch"
                  style={{ background: colorFor(colorMap, c.communityId) }}
                />
                <span className="comm__n">Zajednica {c.communityId}</span>
                <span className="comm__num">{formatNumber(c.members)}</span>
                <span className="comm__yr">{c.medianYear || "—"}</span>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Najviše suradnika" sub="stupanj">
          {degree.loading ? (
            <Loading />
          ) : degree.error ? (
            <ErrorBox message={degree.error} />
          ) : (
            <RankList
              items={degree.data.map((p) => ({
                id: p.personId,
                label: p.name,
                value: p.degree,
              }))}
            />
          )}
        </Panel>
      </div>

      {pairs.data && pairs.data.length > 0 ? (
        <div className="pairs">
          {pairs.data.map((p) => (
            <div className="pair" key={p.actor1 + p.actor2}>
              <div className="pair__names">
                {p.actor1} · {p.actor2}
              </div>
              <div className="pair__meta">
                <span className="pair__n">{p.sharedFilms}</span> zajedničkih
                filmova — zadnji {p.lastYear}.
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="note">
        Zadnja godina suradnje za parove poput Rathbonea i Brucea odgovara
        povijesnom zapisu, sto je koristeno kao provjera ispravnosti uvoza.
      </div>
    </>
  );
}

function Figure({ n, label, accent }) {
  return (
    <div className={accent ? "fig fig--accent" : "fig"}>
      <div className="fig__n">{formatNumber(n)}</div>
      <div className="fig__l">{label}</div>
    </div>
  );
}
