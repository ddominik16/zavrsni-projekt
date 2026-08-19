import { useMemo } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import { colorFor } from "../colors.js";

const WIDTH = 860;
const HEIGHT = 520;

// Simulacija se vrti do kraja odjednom, a onda se crta gotov raspored.
// Tako nema animacijske petlje koja bi na svakom ticku ponovno renderirala
// cijelu komponentu.
function layout(nodes, links) {
  const simNodes = nodes.map((n) => ({ ...n }));
  const simLinks = links.map((l) => ({ ...l }));

  const sim = forceSimulation(simNodes)
    .force(
      "link",
      forceLink(simLinks)
        .id((d) => d.id)
        .distance(60)
        .strength(0.35)
    )
    .force("charge", forceManyBody().strength(-160))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
    .force("collide", forceCollide(12))
    .stop();

  sim.tick(300);

  // Drzimo cvorove unutar okvira da nitko ne zavrsi izvan slike.
  simNodes.forEach((n) => {
    n.x = Math.max(20, Math.min(WIDTH - 20, n.x));
    n.y = Math.max(20, Math.min(HEIGHT - 20, n.y));
  });

  return { simNodes, simLinks };
}

export default function NetworkGraph({
  nodes,
  links,
  seedId,
  colorMap,
  onSelect,
  onHover,
}) {
  const { simNodes, simLinks } = useMemo(
    () => layout(nodes, links),
    [nodes, links]
  );

  const byId = useMemo(() => {
    const map = new Map();
    simNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [simNodes]);

  const maxDegree = useMemo(
    () => Math.max(1, ...simNodes.map((n) => Math.max(0, n.degree || 0))),
    [simNodes]
  );

  return (
    <svg
      className="net__svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Ego-mreza suradnje oko odabrane osobe"
    >
      <g stroke="#131711" strokeOpacity="0.18">
        {simLinks.map((l, i) => {
          const a = typeof l.source === "object" ? l.source : byId.get(l.source);
          const b = typeof l.target === "object" ? l.target : byId.get(l.target);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              strokeWidth={Math.min(3, 0.6 + (l.weight || 1) * 0.35)}
            />
          );
        })}
      </g>

      {simNodes.map((n) => {
        const isSeed = n.id === seedId;
        const share = Math.max(0, n.degree || 0) / maxDegree;
        const r = isSeed ? 11 : 4 + share * 6;
        return (
          <circle
            key={n.id}
            className="net__node"
            cx={n.x}
            cy={n.y}
            r={r}
            fill={colorFor(colorMap, n.community)}
            stroke={isSeed ? "#131711" : "none"}
            strokeWidth={isSeed ? 3 : 0}
            opacity={isSeed ? 1 : 0.85}
            onClick={() => onSelect(n)}
            onMouseEnter={() => onHover(n)}
          >
            <title>{n.name}</title>
          </circle>
        );
      })}

      {simNodes
        .filter(
          (n) => n.id === seedId || Math.max(0, n.degree || 0) > maxDegree * 0.55
        )
        .map((n) => (
          <text
            key={"t-" + n.id}
            x={n.x + 13}
            y={n.y + 4}
            fontFamily="DM Mono, monospace"
            fontSize="10.5"
            fill="#131711"
            stroke="#f4f5ef"
            strokeWidth="3.2"
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            {n.name}
          </text>
        ))}
    </svg>
  );
}
