import { useEffect, useMemo, useState } from "react";
import { searchMovies, getRecommendations, getWhyNot } from "../api.js";
import useFetch from "../useFetch.js";
import { Loading, ErrorBox, Empty } from "../components/States.jsx";
import { formatDecimal, formatNumber, formatRating } from "../format.js";

const SIGNAL_LABELS = {
  genre: "Žanr",
  director: "Redatelj",
  actor: "Glumci",
  gds: "GDS sličnost",
  quality: "Kvaliteta",
  community: "Zajednica",
  award: "Nagrade",
};

// Redoslijed je bitan: signali se crtaju jedan do drugoga u traci, pa su
// boje slozene tako da susjedne budu razlicite i pri daltonizmu. Provjereno
// skriptom, ne na oko.
const SIGNAL_COLORS = {
  genre: "#0d9186",
  director: "#d9a017",
  actor: "#c04a24",
  gds: "#8f4f88",
  quality: "#4577cc",
  community: "#6f8f2f",
  award: "#7a5cc0",
};

const GATE_LABELS = {
  candidate:
    "Ušao u skup kandidata (dijeli glumca, redatelja, SIMILAR_TO ili ≥2 žanra)",
  votes: "Ima barem 10.000 glasova",
  rating: "Ocjena barem 6,0",
  floor: "Prošao prag žanra (druga razina traži ≥50 % poklapanja)",
};

export default function Recommendations() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState(null);

  // Bez odgode bi svako slovo poslalo zahtjev na backend.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results = useFetch(
    () => searchMovies(debounced),
    [debounced],
    debounced.trim().length >= 2
  );

  const recs = useFetch(
    () => getRecommendations(selected.movieId),
    [selected && selected.movieId],
    Boolean(selected)
  );

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">Sustav preporuka</div>
          <h1 className="head__title">Preporuke</h1>
        </div>
        <p className="head__note">
          Sedam normaliziranih signala, težine zbrajaju 1,00. Rezultati su
          razdvojeni prema jačini dokaza.
        </p>
      </div>

      <div className="grid grid--recs">
        <div>
          <input
            className="search__field"
            type="search"
            placeholder="Pretraži film…"
            aria-label="Pretraži film"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="filmlist">
            {debounced.trim().length < 2 ? (
              <Empty message="Upisi barem dva slova." />
            ) : results.loading ? (
              <Loading what="Trazim" />
            ) : results.error ? (
              <ErrorBox message={results.error} />
            ) : results.data.length === 0 ? (
              <Empty message="Nema podudaranja." />
            ) : (
              results.data.map((m) => (
                <button
                  key={m.movieId}
                  className={
                    selected && selected.movieId === m.movieId
                      ? "filmbtn is-sel"
                      : "filmbtn"
                  }
                  onClick={() => setSelected(m)}
                >
                  <span className="filmbtn__t">{m.title}</span>
                  <span className="filmbtn__m">
                    {m.year} · ocjena {formatRating(m.rating)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          {!selected ? (
            <Empty message="Odaberi film s liste." />
          ) : recs.loading ? (
            <Loading what="Racunam preporuke" />
          ) : recs.error ? (
            <ErrorBox message={recs.error} />
          ) : (
            <ResultPane movie={selected} data={recs.data} />
          )}
        </div>
      </div>
    </>
  );
}

function ResultPane({ movie, data }) {
  const [candidate, setCandidate] = useState(null);
  const top = data.graphEvidence[0] || data.genreAndQuality[0];
  const prikazan = candidate || top;

  // Najnizi prikazani rezultat u svakoj razini. Sluzi kao "zid" — film koji
  // je ispod toga nije usao u popis.
  const zid = {
    1: data.graphEvidence.length
      ? data.graphEvidence[data.graphEvidence.length - 1].score
      : null,
    2: data.genreAndQuality.length
      ? data.genreAndQuality[data.genreAndQuality.length - 1].score
      : null,
  };

  return (
    <>
      <div className="target">
        <div>
          <div className="target__t">{movie.title}</div>
          <div className="target__m">
            {movie.year} · ocjena {formatRating(movie.rating)}
          </div>
        </div>
        <div className="target__badge">{movie.movieId}</div>
      </div>

      <Tier
        title="Dokaz iz grafa"
        note="zajednički redatelj, ≥2 glumca ili SIMILAR_TO"
        items={data.graphEvidence}
        onPick={setCandidate}
        picked={candidate}
      />

      <Tier
        title="Žanr i kvaliteta"
        note="bez dokaza iz grafa — bodovi nisu usporedivi"
        items={data.genreAndQuality}
        second
        onPick={setCandidate}
        picked={candidate}
      />

      {prikazan ? <Signals item={prikazan} /> : null}

      <WhyNot seed={movie} zid={zid} />
    </>
  );
}

function Tier({ title, note, items, second, onPick, picked }) {
  return (
    <div className="tier">
      <div className="tier__hd">
        <span className={second ? "tier__block tier__block--2" : "tier__block"} />
        <span className="tier__t">{title}</span>
        <span className="tier__c">{note}</span>
      </div>

      {items.length === 0 ? (
        <Empty message="Nista u ovoj razini." />
      ) : (
        items.map((r, i) => (
          <button
            className={
              picked && picked.movieId === r.movieId ? "rec rec--on" : "rec"
            }
            key={r.movieId}
            onClick={() => onPick(r)}
            title="Prikazi rastav bodova za ovaj film"
          >
            <span className="rec__i">{String(i + 1).padStart(2, "0")}</span>
            <span className="rec__mid">
              <span className="rec__t">{r.title}</span>
              <span className="rec__why">{explain(r)}</span>
            </span>
            <span className="rec__meta">
              {r.year} · {formatRating(r.rating)}
            </span>
            <span className="rec__score">{formatDecimal(r.score)}</span>
          </button>
        ))
      )}
    </div>
  );
}

// ------------------------------------------------------ zasto ne ovaj film

function WhyNot({ seed, zid }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pick, setPick] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results = useFetch(
    () => searchMovies(debounced),
    [debounced],
    debounced.trim().length >= 2
  );

  const why = useFetch(
    () => getWhyNot(seed.movieId, pick.movieId),
    [seed.movieId, pick && pick.movieId],
    Boolean(pick)
  );

  const w = why.data;
  const prag = w ? zid[w.tier] : null;
  const proso = w ? Object.values(w.gates).every(Boolean) : false;
  const dovoljno = w && prag !== null ? w.score >= prag : false;

  return (
    <div className="panel whynot">
      <div className="panel__hd">
        <div className="panel__t">Zašto ne ovaj film</div>
        <div className="panel__sub">provjera pojedinačnog naslova</div>
      </div>
      <div className="panel__bd">
        <p className="secthd__sub" style={{ marginTop: 0 }}>
          Odaberi bilo koji film i sustav pokazuje koliko je bodova dobio prema{" "}
          <strong>{seed.title}</strong> i na kojem je koraku ispao. Za{" "}
          <em>The Hunger Games</em> ovako se vidi zašto Divergent ne prolazi:
          ništa u grafu ne zna što znači „distopijska mladenačka priča”.
        </p>

        <input
          className="search__field"
          type="search"
          placeholder="Pretraži film za provjeru…"
          aria-label="Pretrazi film za provjeru"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {debounced.trim().length >= 2 && results.data ? (
          <div className="filmlist">
            {results.data.slice(0, 5).map((m) => (
              <button
                key={m.movieId}
                className={
                  pick && pick.movieId === m.movieId ? "filmbtn is-sel" : "filmbtn"
                }
                onClick={() => {
                  setPick(m);
                  setQuery("");
                  setDebounced("");
                }}
              >
                <span className="filmbtn__t">{m.title}</span>
                <span className="filmbtn__m">
                  {m.year} · ocjena {formatRating(m.rating)}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {!pick ? null : why.loading ? (
          <Loading what="Racunam" />
        ) : why.error ? (
          <ErrorBox message={why.error} />
        ) : (
          <>
            <div className="verdict">
              <div className="verdict__t">
                {w.title} <span className="verdict__y">{w.year}</span>
              </div>
              <div className="verdict__s">
                {formatDecimal(w.score)}
                {prag !== null ? (
                  <span className="verdict__w">
                    {" "}
                    / zid {formatDecimal(prag)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="verdict__msg">
              {!proso ? (
                <>Ispao je na uvjetu, ne na bodovima.</>
              ) : dovoljno ? (
                <>Prošao je sve uvjete i ima dovoljno bodova za popis.</>
              ) : (
                <>
                  Prošao je sve uvjete, ali mu nedostaje{" "}
                  <strong>{formatDecimal(prag - w.score)}</strong> bodova do
                  zadnjeg filma na popisu.
                </>
              )}
            </div>

            <div className="gates">
              {Object.keys(GATE_LABELS).map((k) => (
                <div
                  className={w.gates[k] ? "gate gate--ok" : "gate gate--no"}
                  key={k}
                >
                  <span className="gate__m">{w.gates[k] ? "✓" : "✕"}</span>
                  <span className="gate__l">{GATE_LABELS[k]}</span>
                </div>
              ))}
            </div>

            <div className="pair__meta" style={{ marginTop: 14 }}>
              {w.sharedActors} zajedničkih glumaca · {w.sharedDirectors}{" "}
              redatelja · {w.sharedGenres} žanrova · poklapanje žanra{" "}
              {formatDecimal(w.genreCoverage * 100, 0)} % ·{" "}
              {formatNumber(w.votes)} glasova · razina {w.tier}.
            </div>

            <Signals item={w} />
          </>
        )}
      </div>
    </div>
  );
}

function explain(r) {
  const bits = [];
  if (r.sharedDirectors > 0) bits.push("isti redatelj");
  if (r.sharedActors > 0) {
    bits.push(
      r.sharedActors === 1
        ? "1 zajednički glumac"
        : r.sharedActors + " zajedničkih glumaca"
    );
  }
  if (r.genreCoverage >= 0.99) bits.push("potpuno poklapanje žanra");
  else if (r.genreCoverage > 0) bits.push("djelomično poklapanje žanra");
  return bits.join(" · ") || "—";
}

function Signals({ item }) {
  const parts = useMemo(() => {
    const entries = Object.keys(item.signals).map((key) => ({
      key,
      label: SIGNAL_LABELS[key],
      color: SIGNAL_COLORS[key],
      value: item.signals[key],
    }));
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    return { entries, total };
  }, [item]);

  return (
    <div className="signals">
      <div className="signals__hd">
        <div className="panel__t">Doprinos signala</div>
        <div className="panel__sub">
          {item.title} — ukupno {formatDecimal(parts.total)}
        </div>
      </div>
      <div className="signals__bd">
        <div className="sigbar">
          {parts.entries
            .filter((e) => e.value > 0)
            .map((e) => (
              <span
                key={e.key}
                style={{
                  flex: (e.value / parts.total) * 100,
                  background: e.color,
                }}
                title={e.label}
              />
            ))}
        </div>
        <div className="siglegend">
          {parts.entries.map((e) => (
            <span className="sigitem" key={e.key}>
              <span
                className="sigitem__sw"
                style={{
                  background: e.color,
                  opacity: e.value === 0 ? 0.28 : 1,
                }}
              />
              <span className="sigitem__l">{e.label}</span>
              <span className="sigitem__v">{formatDecimal(e.value, 3)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
