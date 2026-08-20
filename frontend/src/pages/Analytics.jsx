import { useMemo, useState } from "react";
import {
  getCentrality,
  getCommunities,
  getCommunityMembers,
  getBridging,
  getGenreMatrix,
  getSpread,
  getCompare,
} from "../api.js";
import useFetch from "../useFetch.js";
import Panel from "../components/Panel.jsx";
import RankList from "../components/RankList.jsx";
import { Loading, ErrorBox } from "../components/States.jsx";
import { BarRow, Slope, SpreadStrip, HeatGrid } from "../components/charts.jsx";
import { buildColorMap, colorFor, rampFor, PALETTE, OSTALO } from "../colors.js";
import { zajednica, kratkoIme, OZNAKE_VRSTA } from "../communities.js";
import { formatNumber, formatDecimal } from "../format.js";

// Uz svaku mjeru ide kratko objasnjenje za karticu i duze za tekst ispod
// tablice. Sve cetiri rade nad istim grafom, ali mjere razlicite stvari.
const MEASURES = [
  {
    id: "degree",
    label: "Stupanj",
    short: "Broj različitih osoba s kojima je netko barem jednom glumio.",
    long:
      "Najjednostavnija mjera — samo se broje susjedi u grafu. Visok stupanj " +
      "obično znači dugu karijeru i puno naslova, ali ne govori ništa o tome " +
      "gdje se osoba nalazi u mreži. Netko može imati 800 suradnika koji se " +
      "svi međusobno ionako već poznaju.",
  },
  {
    id: "pageRank",
    label: "PageRank",
    short: "Važan si ako surađuješ s ljudima koji su i sami važni.",
    long:
      "Isti algoritam kojim je Google rangirao stranice, samo što veze ovdje " +
      "nisu poveznice nego zajednički filmovi. Za razliku od stupnja, susjedi " +
      "se ne broje jednako: veza s nekim tko ima 500 suradnika vrijedi manje " +
      "od veze s nekim tko ih ima pet. Pokrenuto do konvergencije, 100 iteracija.",
  },
  {
    id: "betweenness",
    label: "Betweenness",
    short:
      "Na koliko najkraćih puteva između svih ostalih parova osoba netko leži.",
    long:
      "Mjeri posredništvo: visoka vrijednost znači da osoba drži zajedno " +
      "dijelove mreže koji bi inače bili razdvojeni. Ovo je najzanimljiviji " +
      "stupac u radu — algoritam ne zna ništa o nacionalnosti ni jeziku, a na " +
      "vrhu ljestvice završavaju gotovo isključivo glumci s karijerom u dvjema " +
      "ili više nacionalnih kinematografija. Imena koja vode po stupnju padaju " +
      "ispod njih, unatoč dvostruko do trostruko većem broju suradnika. " +
      "Računato na uzorku od 2000 izvornih čvorova, pa su vrijednosti procjena, " +
      "a ne točan broj.",
  },
  {
    id: "closeness",
    label: "Blizina",
    short: "Koliko je osoba u prosjeku blizu svim ostalima.",
    long:
      "Recipročna vrijednost prosječne udaljenosti do svih ostalih čvorova u " +
      "komponenti. U ovom grafu jedva razlikuje ljude, što se vidi i na traci " +
      "raspona niže. To nije greška nego posljedica strukture malog svijeta: " +
      "gotovo svi su svima blizu, pa mjera nosi malo informacije. U radu se " +
      "navodi kao uredan negativan rezultat.",
  },
];

const IMENA_MJERA = {
  degree: "Stupanj",
  pageRank: "PageRank",
  betweenness: "Betweenness",
  closeness: "Blizina",
};

const POJMOVI = [
  {
    t: "Zajednica",
    d:
      "Skupina koju je našao Louvain. Algoritam traži podjelu grafa u kojoj je " +
      "unutar skupina puno više veza nego između njih. Broj je proizvoljan " +
      "identifikator, ne redoslijed ni veličina. Nazivi uz brojeve nisu u bazi " +
      "nego su dodani ručno, nakon pregleda članova.",
  },
  { t: "Članova", d: "Koliko osoba pripada toj zajednici." },
  {
    t: "Filmova",
    d:
      "Koliko je filmova pripisano toj zajednici. Film sam po sebi nema " +
      "zajednicu — nasljeđuje onu koja je najčešća među njegovom glumačkom " +
      "ekipom. Izvedeni podatak, ne rezultat algoritma.",
  },
  {
    t: "Medijan",
    d:
      "Medijan godine izlaska tih filmova. Korisno jer neke zajednice ne " +
      "razdvaja zemlja nego razdoblje: klasični Hollywood ima medijan 1970., " +
      "sljedeća najstarija zajednica 2003.",
  },
  {
    t: "Vanjske veze",
    d:
      "Suradnje koje izlaze iz zajednice prema nekome izvan nje. Udio prvih " +
      "deset pokazuje koliko je taj izlaz skoncentriran u malo ljudi.",
  },
];

export default function Analytics() {
  const [measure, setMeasure] = useState("pageRank");
  const [openCommunity, setOpenCommunity] = useState(null);
  const active = MEASURES.find((m) => m.id === measure) || MEASURES[0];

  const table = useFetch(() => getCentrality(measure, 20), [measure]);
  const bridges = useFetch(() => getCentrality("betweenness", 8), []);
  const communities = useFetch(() => getCommunities(10), []);
  const spread = useFetch(() => getSpread(), []);
  const compare = useFetch(() => getCompare("degree", "betweenness", 12), []);
  const bridging = useFetch(() => getBridging(8), []);
  const genres = useFetch(() => getGenreMatrix(8, 10), []);
  const members = useFetch(
    () => getCommunityMembers(openCommunity, 12),
    [openCommunity],
    openCommunity !== null
  );

  // Jedna paleta za cijelu stranicu, po velicini zajednice, da ista
  // zajednica ima istu boju u svakoj grafici.
  const colorMap = useMemo(() => {
    if (!communities.data) return new Map();
    return buildColorMap(communities.data.map((c) => c.communityId));
  }, [communities.data]);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Analiza mreže</div>
          <h1 className="head__title">Analitika</h1>
        </div>
        <p className="head__note">
          Četiri mjere centralnosti nad istim grafom daju četiri različita
          odgovora. Odaberi mjeru da se tablica presloži.
        </p>
      </div>

      <div className="measures">
        {MEASURES.map((m) => (
          <button
            key={m.id}
            className={m.id === measure ? "measure is-on" : "measure"}
            onClick={() => setMeasure(m.id)}
            aria-pressed={m.id === measure}
          >
            <span className="measure__n">{m.label}</span>
            <span className="measure__d">{m.short}</span>
          </button>
        ))}
      </div>

      <Panel
        title="Centralnost"
        sub={"sortirano po: " + active.label.toLowerCase()}
        flush
      >
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
                    <td>
                      <ZajednicaCelija id={p.communityId} map={colorMap} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="note">
        <strong>{active.label}.</strong> {active.long}
      </div>

      {/* ------------------------------------------- mjere se ne slazu */}

      <h2 className="secthd">Iste osobe, dvije mjere</h2>
      <p className="secthd__sub">
        Lijevo poredak po broju suradnika, desno po posredništvu. Svaka crta je
        jedna osoba, boja je njena zajednica. Da mjere govore isto, crte bi bile
        vodoravne.
      </p>

      <Panel title="Promjena mjesta" sub="stupanj → betweenness" flush>
        <div className="panel__bd">
          {compare.loading ? (
            <Loading />
          ) : compare.error ? (
            <ErrorBox message={compare.error} />
          ) : (
            <>
              <Slope
                people={compare.data.people}
                labelA="Stupanj"
                labelB="Betweenness"
                colorFn={(id) => colorFor(colorMap, id)}
              />
              <Legenda communities={communities.data} map={colorMap} />
            </>
          )}
        </div>
      </Panel>

      <div className="note">
        Poredak je unutar prikazanog skupa, ne kroz cijeli graf — uzeti su
        vrhovi obiju ljestvica pa spojeni. Zato netko tko je visoko po jednoj
        mjeri može biti nisko po drugoj, a da nije nigdje pri dnu grafa.
      </div>

      {/* ---------------------------------------------- raspon mjera */}

      <h2 className="secthd">Koliko mjera uopće razdvaja</h2>
      <p className="secthd__sub">
        Prvih dvadeset osoba po svakoj mjeri, skalirano na vrh te mjere jer su
        jedinice različite. Postotak desno je koliko prvo mjesto nadmašuje
        dvadeseto.
      </p>

      <Panel title="Raspon kroz prvih dvadeset" sub="1. prema 20. mjestu">
        {spread.loading ? (
          <Loading />
        ) : spread.error ? (
          <ErrorBox message={spread.error} />
        ) : (
          <SpreadStrip rows={spread.data} labels={IMENA_MJERA} />
        )}
      </Panel>

      <div className="note">
        Blizina je zbijena u usku traku, betweenness je razvučen preko cijele.
        Kad su svi svima blizu, blizina prestaje razlikovati ljude — to je
        posljedica strukture malog svijeta i navodi se kao negativan rezultat,
        ne kao greška u računu.
      </div>

      {/* ------------------------------------------------- posrednici */}

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

        <Panel title="Zajednice" sub="klik otvara članove" flush>
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
                    <tr
                      key={c.communityId}
                      className={
                        c.communityId === openCommunity ? "row--on" : "row--click"
                      }
                      onClick={() =>
                        setOpenCommunity(
                          c.communityId === openCommunity ? null : c.communityId
                        )
                      }
                    >
                      <td>
                        <ZajednicaCelija id={c.communityId} map={colorMap} />
                      </td>
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

      {openCommunity !== null ? (
        <CommunityDetail
          id={openCommunity}
          members={members}
          communities={communities.data}
          onClose={() => setOpenCommunity(null)}
        />
      ) : null}

      {/* ------------------------------------------- rijetkost, ne udio */}

      <h2 className="secthd">Tko drži vanjske veze</h2>
      <p className="secthd__sub">
        Koliki dio svih veza koje izlaze iz zajednice nose njenih deset
        najpovezanijih ljudi. Visok udio znači da izlaz iz te zajednice ovisi o
        šačici ljudi.
      </p>

      <Panel title="Koncentracija vanjskih veza" sub="udio prvih deset">
        {bridging.loading ? (
          <Loading what="Racunam, prolazi kroz sve veze" />
        ) : bridging.error ? (
          <ErrorBox message={bridging.error} />
        ) : (
          <BarRow
            pct
            items={[...bridging.data]
              .sort((a, b) => b.top10Share - a.top10Share)
              .map((b) => ({
                id: b.communityId,
                label: kratkoIme(b.communityId),
                sub: formatNumber(b.externalTies) + " vanjskih veza",
                value: b.top10Share,
                color: colorFor(colorMap, b.communityId),
                tip:
                  formatNumber(b.top10Ties) +
                  " od " +
                  formatNumber(b.externalTies) +
                  " veza · " +
                  formatDecimal(b.tiesPerMember, 2) +
                  " po članu",
              }))}
          />
        )}
      </Panel>

      <div className="note">
        Ovo je glavni nalaz rada. Očekivao sam da posrednici imaju velik udio
        stranih suradnika, a nemaju — Bachchanovih 97 % suradnika je domaćih, a
        betweenness mu je svejedno visok. Razlog je što indijska zajednica ima
        malo vanjskih veza i one prolaze kroz nekolicinu ljudi, dok su
        hollywoodske razasute po svima i time zamjenjive. Nije stvar udjela nego
        rijetkosti.
      </div>

      {/* --------------------------------------------- zanr i zajednica */}

      <h2 className="secthd">Žanr po zajednici</h2>
      <p className="secthd__sub">
        Koliki dio filmova svake zajednice pripada kojem žanru. Tamnije je veći
        udio. Broj se ispisuje samo u najjačim poljima.
      </p>

      <Panel title="Žanr × zajednica" sub="udio unutar zajednice" flush>
        {genres.loading ? (
          <div className="panel__bd">
            <Loading />
          </div>
        ) : genres.error ? (
          <div className="panel__bd">
            <ErrorBox message={genres.error} />
          </div>
        ) : (
          <HeatGrid
            genres={genres.data.genres}
            communities={genres.data.communities}
            nameFn={(id) => kratkoIme(id)}
            colorFn={rampFor}
          />
        )}
      </Panel>

      <div className="note">
        Većina zajednica dijeli se po zemlji, ali tri ne: nezavisni horor,
        direct-to-video akcija i sinkronizacija. Njih je Louvain izdvojio po
        načinu produkcije, a ne po jeziku, i to se vidi na ovoj karti kao
        jedan jaki žanr umjesto raspršenog profila.
      </div>

      <h2 className="secthd">Kako čitati ove brojke</h2>
      <div className="defs">
        {POJMOVI.map((p) => (
          <div className="def" key={p.t}>
            <div className="def__t">{p.t}</div>
            <div className="def__d">{p.d}</div>
          </div>
        ))}
      </div>

      <div className="note">
        Sve četiri mjere računate su nad istim projiciranim grafom suradnje, pa
        razlike u poretku dolaze iz same mjere, a ne iz različitih podataka.
        Vrijednosti su zapisane na čvorove tijekom faza 5 i 6 — aplikacija ih
        samo čita i ništa ne računa u trenutku otvaranja stranice.
      </div>
    </>
  );
}

// -------------------------------------------------------------- pomocno

function ZajednicaCelija({ id, map }) {
  if (id === null || id === undefined) return <span>—</span>;
  const z = zajednica(id);
  return (
    <span className="cellcomm">
      <span
        className="comm__swatch"
        style={{ background: colorFor(map, id) }}
      />
      <span className="commname">{z.naziv || "Zajednica"}</span>
      <span className="commid">{id}</span>
    </span>
  );
}

function Legenda({ communities, map }) {
  if (!communities) return null;
  const prve = communities.slice(0, PALETTE.length);
  const ima_ostale = communities.length > PALETTE.length;
  return (
    <div className="net__legend">
      {prve.map((c) => (
        <span className="legitem" key={c.communityId}>
          <span
            className="legitem__sw"
            style={{ background: colorFor(map, c.communityId) }}
          />
          {kratkoIme(c.communityId)}
        </span>
      ))}
      {ima_ostale ? (
        <span className="legitem">
          <span className="legitem__sw" style={{ background: OSTALO }} />
          ostale zajednice
        </span>
      ) : null}
    </div>
  );
}

function CommunityDetail({ id, members, communities, onClose }) {
  const z = zajednica(id);
  const red = (communities || []).find((c) => c.communityId === id);

  return (
    <div className="panel" style={{ marginTop: 28 }}>
      <div className="panel__hd">
        <div className="panel__t">
          {z.naziv || "Zajednica"}
          <span className="commid">{id}</span>
          {OZNAKE_VRSTA[z.vrsta] ? (
            <span className="commbadge">{OZNAKE_VRSTA[z.vrsta]}</span>
          ) : null}
        </div>
        <button className="linkbtn" onClick={onClose}>
          zatvori
        </button>
      </div>
      <div className="panel__bd">
        {red ? (
          <div className="pair__meta" style={{ marginBottom: 12 }}>
            {formatNumber(red.members)} osoba · {formatNumber(red.films)} filmova
            · medijan {red.medianYear || "—"}.
            {z.nesigurno
              ? " Naziv ove zajednice nije siguran — članovi su mješoviti."
              : ""}
          </div>
        ) : null}

        {members.loading ? (
          <Loading />
        ) : members.error ? (
          <ErrorBox message={members.error} />
        ) : (
          <RankList
            items={members.data.map((p) => ({
              id: p.personId,
              label: p.name,
              value: p.degree,
            }))}
          />
        )}
      </div>
    </div>
  );
}
