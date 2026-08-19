import { useEffect, useMemo, useState } from "react";
import { searchMovies, getRecommendations } from "../api.js";
import useFetch from "../useFetch.js";
import { Loading, ErrorBox, Empty } from "../components/States.jsx";
import { formatDecimal, formatRating } from "../format.js";

const SIGNAL_LABELS = {
  genre: "Žanr",
  director: "Redatelj",
  actor: "Glumci",
  gds: "GDS sličnost",
  quality: "Kvaliteta",
  community: "Zajednica",
  award: "Nagrade",
};

const SIGNAL_COLORS = {
  genre: "#10514e",
  director: "#c89b1e",
  actor: "#a8391f",
  gds: "#6a3550",
  quality: "#2c4257",
  community: "#5f6f33",
  award: "#a96f44",
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
  const top = data.graphEvidence[0] || data.genreAndQuality[0];

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
      />

      <Tier
        title="Žanr i kvaliteta"
        note="bez dokaza iz grafa — bodovi nisu usporedivi"
        items={data.genreAndQuality}
        second
      />

      {top ? <Signals item={top} /> : null}
    </>
  );
}

function Tier({ title, note, items, second }) {
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
          <div className="rec" key={r.movieId}>
            <span className="rec__i">{String(i + 1).padStart(2, "0")}</span>
            <span className="rec__mid">
              <span className="rec__t">{r.title}</span>
              <span className="rec__why">{explain(r)}</span>
            </span>
            <span className="rec__meta">
              {r.year} · {formatRating(r.rating)}
            </span>
            <span className="rec__score">{formatDecimal(r.score)}</span>
          </div>
        ))
      )}
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
