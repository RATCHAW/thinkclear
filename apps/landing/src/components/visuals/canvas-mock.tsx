/**
 * The mindmap canvas, drawn rather than screenshotted.
 *
 * Colors are the app's own — `#ffe600` root, `#ffe599` topics, `#2b78e4`
 * edges on a 24px dot grid — because the canvas deliberately deviates from the
 * app's design system and recoloring it to match this page would misrepresent
 * what the product looks like.
 *
 * It draws itself on load: edges stroke on, then the topics they lead to
 * settle in behind them. That is the one thing a still image cannot say —
 * that a map here is built a branch at a time.
 */

interface Topic {
  x: number;
  y: number;
  width: number;
  label: string;
  /** Root topics are bigger, brighter, and set heavier. */
  root?: boolean;
  /** The app marks a topic that carries a note. */
  note?: boolean;
  delay: number;
}

const TOPIC_HEIGHT = 44;

const TOPICS: Topic[] = [
  { x: 36, y: 194, width: 168, label: "Launch plan", root: true, delay: 0 },
  { x: 272, y: 47, width: 152, label: "Positioning", note: true, delay: 260 },
  { x: 272, y: 167, width: 152, label: "Pricing", delay: 300 },
  { x: 272, y: 287, width: 152, label: "Launch week", delay: 340 },
  { x: 492, y: 11, width: 176, label: "Who it's for", delay: 520 },
  { x: 492, y: 71, width: 176, label: "What it replaces", delay: 560 },
  { x: 492, y: 165, width: 176, label: "Free while in beta", delay: 600 },
  { x: 492, y: 255, width: 176, label: "Changelog post", delay: 640 },
  { x: 492, y: 315, width: 176, label: "Demo video", delay: 680 },
];

interface Edge {
  d: string;
  /** Roughly the path's length — what `stroke-dasharray` hides it with. */
  length: number;
  delay: number;
}

const EDGES: Edge[] = [
  { d: "M204,216 C240,216 236,69 272,69", length: 180, delay: 120 },
  { d: "M204,216 C240,216 236,189 272,189", length: 85, delay: 160 },
  { d: "M204,216 C240,216 236,309 272,309", length: 130, delay: 200 },
  { d: "M424,69 C458,69 458,33 492,33", length: 85, delay: 400 },
  { d: "M424,69 C458,69 458,93 492,93", length: 80, delay: 440 },
  { d: "M424,189 C458,189 458,187 492,187", length: 72, delay: 480 },
  { d: "M424,309 C458,309 458,277 492,277", length: 82, delay: 520 },
  { d: "M424,309 C458,309 458,337 492,337", length: 80, delay: 560 },
];

export function CanvasMock() {
  return (
    <svg
      viewBox="0 0 700 372"
      className="block h-auto w-full"
      role="img"
      aria-label="A mindmap titled Launch plan branching into Positioning, Pricing, and Launch week, each with its own topics."
    >
      <defs>
        <pattern
          id="canvas-dots"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="#d4e0ed" />
        </pattern>
      </defs>

      <rect width="700" height="372" fill="#ffffff" />
      <rect width="700" height="372" fill="url(#canvas-dots)" />

      {EDGES.map((edge) => (
        <path
          key={edge.d}
          className="topic-edge"
          style={
            {
              "--edge-length": `${edge.length}`,
              animationDelay: `${edge.delay}ms`,
            } as React.CSSProperties
          }
          d={edge.d}
          fill="none"
          stroke="#2b78e4"
          strokeWidth={2}
        />
      ))}

      {TOPICS.map((topic) => {
        const centerY = topic.y + TOPIC_HEIGHT / 2;
        return (
          <g
            key={topic.label}
            className="topic-node"
            style={{ animationDelay: `${topic.delay}ms` }}
          >
            <rect
              x={topic.x}
              y={topic.y}
              width={topic.width}
              height={TOPIC_HEIGHT}
              rx={6}
              fill={topic.root ? "#ffe600" : "#ffe599"}
              stroke="#0a0a0a"
              strokeWidth={2}
            />
            <text
              x={topic.x + topic.width / 2 + (topic.note ? 8 : 0)}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#0a0a0a"
              fontSize={topic.root ? 17 : 14}
              fontWeight={topic.root ? 700 : 600}
            >
              {topic.label}
            </text>
            {topic.note ? (
              <circle
                cx={topic.x + 16}
                cy={centerY}
                r={3.5}
                fill="#0a0a0a"
                opacity={0.55}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
