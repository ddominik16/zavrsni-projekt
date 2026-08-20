// Male grafike crtane rucno u SVG-u. Nema biblioteke za grafove jer su
// oblici jednostavni, a jedna ovisnost manje.
//
// Zajednicka pravila, drzim ih na svim grafovima:
//   - tanke oznake, zaobljeni vrh stupca, razmak izmedju susjednih stupaca
//   - osi i mreza svijetle, podaci tamni
//   - broj se ispisuje samo gdje nesto znaci, ne na svakoj tocki
//   - sve sto se moze pokazati misem ima opisni oblacic

import { useState } from "react";
import { formatNumber, formatDecimal } from "../format.js";

// --------------------------------------------------------------- oblacic

function useTip() {
  const [tip, setTip] = useState(null);

  function show(e, lines) {
    const host = e.currentTarget.closest(".chart");
    if (!host) return;
    const r = host.getBoundingClientRect();
    // drzim oblacic unutar okvira grafa da ne visi preko ruba
    const x = Math.max(60, Math.min(r.width - 60, e.clientX - r.left));
    setTip({ x, y: e.clientY - r.top, lines });
  }

  return [tip, show, () => setTip(null)];
}

function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      {tip.lines.map((l, i) => (
        <div key={i} className={i === 0 ? "tip__t" : "tip__l"}>
          {l}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------- stupci kroz vrijeme

export function ColumnChart({ data, xKey, yKey, xLabel, unit = "" }) {
  const [tip, show, hide] = useTip();

  const W = 720;
  const H = 200;
  const PAD_B = 26;
  const PAD_T = 16;

  const max = Math.max(1, ...data.map((d) => d[yKey] || 0));
  const stupac = W / Math.max(1, data.length);
  const sirina = Math.max(4, stupac - 6); // 6px praznine izmedju stupaca
  const najveci = data.reduce((a, b) => ((b[yKey] || 0) > (a[yKey] || 0) ? b : a), data[0]);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" role="img"
           aria-label={xLabel || "Stupcasti graf"}>
        <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B}
              stroke="#c8cbbf" strokeWidth="1" />

        {data.map((d, i) => {
          const v = d[yKey] || 0;
          const h = ((H - PAD_B - PAD_T) * v) / max;
          const x = i * stupac + (stupac - sirina) / 2;
          const y = H - PAD_B - h;
          const vrh = d === najveci;
          return (
            <g key={d[xKey]}>
              <rect
                x={x} y={y} width={sirina} height={Math.max(1, h)}
                rx="3"
                fill={vrh ? "#0d9186" : "#454c41"}
                opacity={vrh ? 1 : 0.72}
                onMouseMove={(e) =>
                  show(e, [String(d[xKey]), formatNumber(v) + (unit ? " " + unit : "")])
                }
                onMouseLeave={hide}
              />
              <text x={x + sirina / 2} y={H - PAD_B + 14}
                    textAnchor="middle" fontSize="10.5"
                    fontFamily="DM Mono, monospace" fill="#767d70">
                {d[xKey]}
              </text>
            </g>
          );
        })}

        {/* broj se pise samo na najvisem stupcu */}
        {najveci ? (
          <text
            x={data.indexOf(najveci) * stupac + stupac / 2}
            y={H - PAD_B - ((H - PAD_B - PAD_T) * (najveci[yKey] || 0)) / max - 6}
            textAnchor="middle" fontSize="11" fontWeight="600"
            fontFamily="DM Mono, monospace" fill="#131711"
          >
            {formatNumber(najveci[yKey])}
          </text>
        ) : null}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

// ------------------------------------------------------ vodoravni stupci

export function BarRow({ items, unit = "", pct = false }) {
  const [tip, show, hide] = useTip();
  const max = Math.max(...items.map((i) => i.value || 0), 0.0001);

  return (
    <div className="chart barrow">
      {items.map((it) => (
        <div className="barrow__r" key={it.id ?? it.label}>
          <div className="barrow__l">
            {it.label}
            {it.sub ? <span className="barrow__s">{it.sub}</span> : null}
          </div>
          <div className="barrow__track">
            <div
              className="barrow__fill"
              style={{
                width: Math.max(1, (it.value / max) * 100) + "%",
                background: it.color || "#0d9186",
              }}
              onMouseMove={(e) => show(e, [it.label, it.tip || ""])}
              onMouseLeave={hide}
            />
          </div>
          <div className="barrow__v">
            {pct
              ? formatDecimal(it.value * 100, 1) + " %"
              : formatNumber(it.value) + (unit ? " " + unit : "")}
          </div>
        </div>
      ))}
      <Tip tip={tip} />
    </div>
  );
}

// --------------------------------------------------- promjena mjesta

// Lijevo poredak po jednoj mjeri, desno po drugoj, crta spaja istu osobu.
// Boja prati zajednicu, ne mjesto na ljestvici.
export function Slope({ people, labelA, labelB, colorFn }) {
  const [tip, show, hide] = useTip();

  const n = people.length;
  const W = 720;
  const RED = 24;
  const H = n * RED + 54;
  const TOP = 34;
  const LX = 250;
  const RX = W - 250;

  const y = (rank) => TOP + (rank - 1) * RED;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" role="img"
           aria-label={`Promjena mjesta izmedju mjera ${labelA} i ${labelB}`}>
        <text x={LX} y="16" textAnchor="end" fontSize="10.5"
              fontFamily="DM Mono, monospace" fill="#767d70"
              letterSpacing="0.1em">
          {labelA.toUpperCase()}
        </text>
        <text x={RX} y="16" fontSize="10.5"
              fontFamily="DM Mono, monospace" fill="#767d70"
              letterSpacing="0.1em">
          {labelB.toUpperCase()}
        </text>

        {people.map((p) => {
          const boja = colorFn(p.communityId);
          const pomak = p.rankA - p.rankB;
          return (
            <g key={p.personId}
               onMouseMove={(e) =>
                 show(e, [
                   p.name,
                   `${labelA}: ${p.rankA}.  →  ${labelB}: ${p.rankB}.`,
                   pomak === 0 ? "bez promjene"
                     : pomak > 0 ? `gore za ${pomak}` : `dolje za ${-pomak}`,
                 ])
               }
               onMouseLeave={hide}>
              <line
                x1={LX + 10} y1={y(p.rankA)} x2={RX - 10} y2={y(p.rankB)}
                stroke={boja} strokeWidth="2" opacity="0.75"
                strokeLinecap="round"
              />
              <circle cx={LX + 10} cy={y(p.rankA)} r="4" fill={boja}
                      stroke="#f4f5ef" strokeWidth="2" />
              <circle cx={RX - 10} cy={y(p.rankB)} r="4" fill={boja}
                      stroke="#f4f5ef" strokeWidth="2" />
              <text x={LX} y={y(p.rankA) + 4} textAnchor="end"
                    fontSize="11.5" fill="#131711">
                {p.rankA}. {p.name}
              </text>
              <text x={RX} y={y(p.rankB) + 4} fontSize="11.5" fill="#131711">
                {p.rankB}. {p.name}
              </text>
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

// ------------------------------------------------------- raspon mjera

// Svaka mjera je skalirana na svoj vrh, inace se ne bi mogle usporediti
// jer su u razlicitim jedinicama. Crtice su prvih dvadeset osoba.
export function SpreadStrip({ rows, labels }) {
  const [tip, show, hide] = useTip();

  return (
    <div className="chart">
      {rows.map((r) => {
        const max = Math.max(...r.values);
        return (
          <div className="spread" key={r.measure}>
            <div className="spread__l">{labels[r.measure] || r.measure}</div>
            <div className="spread__track">
              <div
                className="spread__span"
                style={{
                  left: (Math.min(...r.values) / max) * 100 + "%",
                  right: 0,
                }}
              />
              {r.values.map((v, i) => (
                <span
                  key={i}
                  className="spread__tick"
                  style={{ left: (v / max) * 100 + "%" }}
                  onMouseMove={(e) =>
                    show(e, [
                      labels[r.measure] || r.measure,
                      `${i + 1}. mjesto`,
                      formatDecimal((v / max) * 100, 1) + " % vrha",
                    ])
                  }
                  onMouseLeave={hide}
                />
              ))}
            </div>
            <div className="spread__v">
              {formatDecimal(r.spread * 100, r.spread < 0.1 ? 1 : 0)} %
            </div>
          </div>
        );
      })}
      <Tip tip={tip} />
    </div>
  );
}

// ------------------------------------------------------- toplinska karta

export function HeatGrid({ genres, communities, nameFn, colorFn }) {
  const [tip, show, hide] = useTip();

  // Udio se racuna unutar zajednice: koliki dio njenih filmova je taj zanr.
  const udio = (g, c) => {
    const n = g.counts[c.communityId] || 0;
    return c.films ? n / c.films : 0;
  };
  const max = Math.max(
    ...genres.flatMap((g) => communities.map((c) => udio(g, c))),
    0.0001
  );

  return (
    <div className="chart">
      <div className="tblwrap">
        <table className="heat">
          <thead>
            <tr>
              <th />
              {communities.map((c) => (
                <th key={c.communityId} title={nameFn(c.communityId)}>
                  {(nameFn(c.communityId) || "").split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {genres.map((g) => (
              <tr key={g.genre}>
                <th scope="row">{g.genre}</th>
                {communities.map((c) => {
                  const u = udio(g, c);
                  return (
                    <td
                      key={c.communityId}
                      style={{ background: colorFn(u, max) }}
                      onMouseMove={(e) =>
                        show(e, [
                          `${g.genre} · ${nameFn(c.communityId)}`,
                          formatNumber(g.counts[c.communityId] || 0) + " filmova",
                          formatDecimal(u * 100, 1) + " % zajednice",
                        ])
                      }
                      onMouseLeave={hide}
                    >
                      {u >= max * 0.55 ? Math.round(u * 100) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Tip tip={tip} />
    </div>
  );
}
