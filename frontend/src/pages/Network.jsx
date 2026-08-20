import { useEffect, useMemo, useState } from "react";
import {
  searchPeople,
  getNetwork,
  getPerson,
  getPath,
  getBridgeCutoff,
} from "../api.js";
import useFetch from "../useFetch.js";
import NetworkGraph from "../components/NetworkGraph.jsx";
import { Loading, ErrorBox, Empty } from "../components/States.jsx";
import { buildColorMap, colorFor, PALETTE, OSTALO } from "../colors.js";
import { zajednica, kratkoIme } from "../communities.js";
import { formatNumber, formatDecimal } from "../format.js";

// Parovi iz rada. Svi su poznati glumci s međunarodnim karijerama i kod
// njih put ide oko posrednika, jer je zvijezda sama sebi most.
const PRIMJERI = [
  ["Shah Rukh Khan", "Nicolas Cage"],
  ["Amitabh Bachchan", "Tom Hanks"],
  ["Kemal Sunal", "Robert De Niro"],
  ["Song Kang-ho", "Meryl Streep"],
  ["Cem Yılmaz", "Julianne Moore"],
];

export default function Network() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [seedId, setSeedId] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const people = useFetch(
    () => searchPeople(debounced),
    [debounced],
    debounced.trim().length >= 2
  );

  const net = useFetch(() => getNetwork(seedId, 60), [seedId], Boolean(seedId));

  const detail = useFetch(
    () => getPerson(hovered ? hovered.id : seedId),
    [hovered && hovered.id, seedId],
    Boolean(hovered || seedId)
  );

  // Boje ima samo cetiri, pa ih dajem najbrojnijim zajednicama u ovom
  // isjecku grafa. Ostale dijele neutralnu.
  const colorMap = useMemo(() => {
    if (!net.data) return new Map();
    const broj = new Map();
    net.data.nodes.forEach((n) => {
      if (n.community === null || n.community === undefined) return;
      broj.set(n.community, (broj.get(n.community) || 0) + 1);
    });
    const ids = [...broj.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    return buildColorMap(ids);
  }, [net.data]);

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Istraživač mreže</div>
          <h1 className="head__title">Mreža</h1>
        </div>
        <p className="head__note">
          Ego-mreža oko jedne osobe. Klik na čvor pomiče središte, pa se graf
          može obilaziti korak po korak.
        </p>
      </div>

      <input
        className="search__field"
        type="search"
        placeholder="Pretraži glumca…"
        aria-label="Pretraži glumca"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ maxWidth: 420 }}
      />

      {debounced.trim().length >= 2 && people.data ? (
        <div className="filmlist" style={{ maxWidth: 420 }}>
          {people.data.slice(0, 6).map((p) => (
            <button
              key={p.personId}
              className={p.personId === seedId ? "filmbtn is-sel" : "filmbtn"}
              onClick={() => {
                setSeedId(p.personId);
                setHovered(null);
                setQuery("");
                setDebounced("");
              }}
            >
              <span className="filmbtn__t">{p.name}</span>
              <span className="filmbtn__m">{p.degree} suradnika</span>
            </button>
          ))}
        </div>
      ) : null}

      {!seedId ? (
        <Empty message="Pretraži glumca da bi se prikazala njegova mreža." />
      ) : (
        <div className="grid grid--net">
          <div>
            <div className="netwrap">
              {net.loading ? (
                <Loading what="Ucitavam mrezu" />
              ) : net.error ? (
                <ErrorBox message={net.error} />
              ) : (
                <>
                  <NetworkGraph
                    nodes={net.data.nodes}
                    links={net.data.links}
                    seedId={net.data.seedId}
                    colorMap={colorMap}
                    onSelect={(n) => {
                      setSeedId(n.id);
                      setHovered(null);
                    }}
                    onHover={(n) => setHovered(n)}
                  />
                  <div className="net__legend">
                    {[...colorMap.keys()].slice(0, PALETTE.length).map((id) => (
                      <span className="legitem" key={id}>
                        <span
                          className="legitem__sw"
                          style={{ background: colorFor(colorMap, id) }}
                        />
                        {kratkoIme(id)}
                      </span>
                    ))}
                    {colorMap.size > PALETTE.length ? (
                      <span className="legitem">
                        <span
                          className="legitem__sw"
                          style={{ background: OSTALO }}
                        />
                        ostale zajednice
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <PathFinder />
          </div>

          <div className="inspect">
            {detail.loading ? (
              <Loading />
            ) : detail.error ? (
              <ErrorBox message={detail.error} />
            ) : detail.data ? (
              <PersonCard person={detail.data} onFocus={() => setSeedId(detail.data.personId)} />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function PersonCard({ person, onFocus }) {
  return (
    <>
      <div className="inspect__hd">
        <div className="inspect__nm">{person.name}</div>
        <div className="inspect__c">
          {person.communityId === null || person.communityId === undefined
            ? "bez zajednice"
            : (zajednica(person.communityId).naziv || "zajednica") +
              " · " +
              person.communityId}
        </div>
      </div>
      <div className="stat">
        <span className="stat__l">Suradnika</span>
        <span className="stat__v">{formatNumber(person.degree)}</span>
      </div>
      <div className="stat">
        <span className="stat__l">Filmova</span>
        <span className="stat__v">{formatNumber(person.filmCount)}</span>
      </div>
      <div className="stat">
        <span className="stat__l">PageRank</span>
        <span className="stat__v">{formatDecimal(person.pageRank, 2)}</span>
      </div>
      <div className="stat">
        <span className="stat__l">Betweenness</span>
        <span className="stat__v stat__v--brick">
          {formatNumber(person.betweenness)}
        </span>
      </div>
      {person.topFilms && person.topFilms.length ? (
        <div className="inspect__films">{person.topFilms.join(" · ")}</div>
      ) : null}
      <button className="btn" onClick={onFocus}>
        Postavi kao središte
      </button>
    </>
  );
}

function PathFinder() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ids, setIds] = useState(null);
  const [greska, setGreska] = useState(null);

  // Granicu za "posrednik" racuna baza (gornji postotak po betweennessu),
  // da ne pise fiksan broj u kodu.
  const cutoff = useFetch(() => getBridgeCutoff(), []);
  const granica = cutoff.data ? cutoff.data.cutoff : Infinity;

  const path = useFetch(
    () => getPath(ids.from, ids.to),
    [ids && ids.from, ids && ids.to],
    Boolean(ids)
  );

  async function trazi(imeA, imeB) {
    setGreska(null);
    // Iz imena prvo dohvatimo personId, jer imena nisu jedinstvena.
    const [a, b] = await Promise.all([searchPeople(imeA), searchPeople(imeB)]);
    if (!a.length || !b.length) {
      setGreska("Nisam našao " + (!a.length ? imeA : imeB) + " u bazi.");
      setIds(null);
      return;
    }
    setIds({ from: a[0].personId, to: b[0].personId });
  }

  function submit(e) {
    e.preventDefault();
    if (!from.trim() || !to.trim()) return;
    trazi(from, to);
  }

  const ljudi = path.data ? path.data.people : [];
  const posrednici = ljudi.filter(
    (p, i) => i > 0 && i < ljudi.length - 1 && p.betweenness >= granica
  );

  return (
    <div className="panel" style={{ marginTop: 28 }}>
      <div className="panel__hd">
        <div className="panel__t">Najkraći put</div>
        <div className="panel__sub">preko veza suradnje</div>
      </div>
      <div className="panel__bd">
        <form className="pathform" onSubmit={submit}>
          <input
            placeholder="Od (ime glumca)"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Od"
          />
          <input
            placeholder="Do (ime glumca)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Do"
          />
          <button type="submit">Pronađi</button>
        </form>

        <div className="presets">
          <span className="presets__l">Primjeri iz rada:</span>
          {PRIMJERI.map(([a, b]) => (
            <button
              key={a + b}
              className="preset"
              onClick={() => {
                setFrom(a);
                setTo(b);
                trazi(a, b);
              }}
            >
              {a} → {b}
            </button>
          ))}
        </div>

        {greska ? <ErrorBox message={greska} /> : null}

        {!ids ? null : path.loading ? (
          <Loading what="Trazim put" />
        ) : path.error ? (
          <ErrorBox message={path.error} />
        ) : (
          <>
            <div className="pathrow">
              {ljudi.map((p, i) => (
                <span key={p.id} style={{ display: "contents" }}>
                  {i > 0 ? <span className="arrow">→</span> : null}
                  <span
                    className={
                      i === 0 || i === ljudi.length - 1
                        ? "chip chip--end"
                        : p.betweenness >= granica
                        ? "chip chip--bridge"
                        : "chip"
                    }
                    title={
                      zajednica(p.community).naziv
                        ? zajednica(p.community).naziv + " · " + p.community
                        : "zajednica " + p.community
                    }
                  >
                    {p.name}
                  </span>
                </span>
              ))}
            </div>

            <div className="pair__meta" style={{ marginTop: 14 }}>
              {path.data.hops} koraka.{" "}
              {posrednici.length ? (
                <>
                  Kroz {posrednici.length === 1 ? "posrednika" : "posrednike"}:{" "}
                  <strong>{posrednici.map((p) => p.name).join(", ")}</strong>.
                </>
              ) : (
                <>Nijedan međukorak nije u gornjem postotku po posredništvu.</>
              )}
            </div>

            <div className="pathlegend">
              <span className="legitem">
                <span className="legitem__sw legitem__sw--bridge" />
                posrednik — gornji postotak po betweennessu
              </span>
              <span className="legitem">
                <span className="legitem__sw legitem__sw--plain" />
                obična veza
              </span>
            </div>
          </>
        )}

        <div className="pathnote">
          Zvijezde s međunarodnim karijerama obično zaobiđu posrednike jer su
          same sebi most. Sporedni glumci bez inozemnih uloga nemaju izbora i
          put im ide kroz nekoga tko spaja dvije kinematografije.
        </div>
      </div>
    </div>
  );
}
