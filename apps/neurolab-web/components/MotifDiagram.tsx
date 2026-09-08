import type { MotifDef, MotifEdge, MotifNode } from "@/lib/motifAtlas";

/**
 * A motif is small enough to draw exactly, so it is drawn rather than
 * described. Excitatory edges end in an arrow, inhibitory ones in a bar —
 * the convention every neuroscience paper uses — and gap junctions get the
 * resistor symbol, since they are bidirectional and have no sign.
 */

const R = 7.4;

const KIND_CLASS: Record<MotifNode["kind"], string> = {
  input: "mx-node mx-input",
  excitatory: "mx-node mx-exc",
  inhibitory: "mx-node mx-inh",
  output: "mx-node mx-out",
};

/** Pull the endpoints back to the node edge so the marker sits on the rim. */
function geometry(a: MotifNode, b: MotifNode, curve: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;

  // Control point pushed perpendicular to the chord.
  const cx = mx - (dy / len) * curve;
  const cy = my + (dx / len) * curve;

  const towardStart = { x: cx - a.x, y: cy - a.y };
  const sLen = Math.hypot(towardStart.x, towardStart.y) || 1;
  const start = { x: a.x + (towardStart.x / sLen) * R, y: a.y + (towardStart.y / sLen) * R };

  const towardEnd = { x: cx - b.x, y: cy - b.y };
  const eLen = Math.hypot(towardEnd.x, towardEnd.y) || 1;
  // Leave room for the marker itself.
  const back = R + 3.2;
  const end = { x: b.x + (towardEnd.x / eLen) * back, y: b.y + (towardEnd.y / eLen) * back };

  const angle = Math.atan2(end.y - cy, end.x - cx);
  return { start, end, cx, cy, angle };
}

function Edge({ edge, nodes, idx }: { edge: MotifEdge; nodes: Map<string, MotifNode>; idx: number }) {
  const a = nodes.get(edge.from);
  const b = nodes.get(edge.to);
  if (!a || !b) return null;

  const { start, end, cx, cy, angle } = geometry(a, b, edge.curve ?? 0);
  const d = `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
  const deg = (angle * 180) / Math.PI;

  if (edge.kind === "electrical") {
    return (
      <g className="mx-edge mx-gap">
        <path d={d} />
        <g transform={`translate(${cx} ${cy}) rotate(${deg})`}>
          <path className="mx-gap-mark" d="M -3.4 -2.6 L -3.4 2.6 M 0 -3.4 L 0 3.4 M 3.4 -2.6 L 3.4 2.6" />
        </g>
      </g>
    );
  }

  return (
    <g className={edge.sign === 1 ? "mx-edge mx-exc-edge" : "mx-edge mx-inh-edge"}>
      <path d={d} markerEnd={edge.sign === 1 ? `url(#mx-arrow-${idx})` : undefined} />
      {edge.sign === -1 && (
        <g transform={`translate(${end.x} ${end.y}) rotate(${deg})`}>
          <path className="mx-bar" d="M 0 -3.6 L 0 3.6" />
        </g>
      )}
    </g>
  );
}

export function MotifDiagram({ motif, compact }: { motif: MotifDef; compact?: boolean }) {
  const nodes = new Map(motif.nodes.map((n) => [n.id, n]));

  return (
    <svg
      className={compact ? "mx-diagram mx-compact" : "mx-diagram"}
      viewBox="0 0 120 72"
      role="img"
      aria-label={`${motif.name}: ${motif.computes}`}
    >
      <defs>
        {motif.edges.map((_, i) => (
          <marker
            key={i}
            id={`mx-arrow-${i}`}
            viewBox="0 0 8 8"
            refX="6"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path className="mx-arrowhead" d="M 0 1 L 7 4 L 0 7 z" />
          </marker>
        ))}
      </defs>

      {motif.edges.map((edge, i) => (
        <Edge key={`${edge.from}-${edge.to}-${i}`} edge={edge} nodes={nodes} idx={i} />
      ))}

      {motif.nodes.map((node) => (
        <g key={node.id} className={KIND_CLASS[node.kind]}>
          <circle cx={node.x} cy={node.y} r={R} />
          {node.label && !compact && (
            <text x={node.x} y={node.y + 2.4} textAnchor="middle">
              {node.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
