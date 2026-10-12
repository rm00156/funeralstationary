/**
 * Hand-drawn ornaments for the clipart set — the dove, swash, scroll divider
 * and scrolled frame that classic order-of-service covers are built from and
 * lucide doesn't have. Drawn in currentColor like the lucide icons beside
 * them, so the editor's colour swatches recolour them too.
 *
 * Each keeps its own viewBox shape and lines (they ignore `strokeWidth`, which
 * is tuned for lucide's 24-unit grid): a clipart box of the same proportions
 * (CLIPARTS' `aspect`) fills exactly, any other box letterboxes it.
 */

interface OrnamentProps {
  size?: number | string;
  strokeWidth?: number;
  color?: string;
}

function Ornament({
  size = 24,
  viewBox,
  children,
}: {
  size?: number | string;
  viewBox: string;
  children: React.ReactNode;
}) {
  return (
    <svg width={size} height={size} viewBox={viewBox} className="block" aria-hidden>
      {children}
    </svg>
  );
}

/** A dove in flight, rising to the right. */
export function Dove({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 64 48">
      <g fill="currentColor">
        <path
          opacity="0.7"
          d="M41 22 C41.5 15 44 8.5 48.5 3 C48.3 6.5 47.8 8.5 47 10.5 C48.6 9.6 50 9.4 51.2 9.6 C49 11.5 47.5 13 46.5 14.8 C47.6 14.6 48.6 14.7 49.4 15 C47 16.8 45.5 19 44.5 22 Z"
        />
        <path d="M60.5 17.5 L56.6 17.2 C55.8 15.4 53.6 14.6 51.8 15.4 C49.6 16.4 48.6 19.4 46 22 C42 26 35 27.8 27.5 30 C21 32 15 35.5 8.5 40.5 L14 40 L10.5 44.5 L17 41.5 C27 42.5 37.5 40.5 44 35 C48.5 31 51.5 25.5 53.5 21 C54.3 19.4 55.6 18.6 56.6 18.4 Z" />
        <path d="M41 23.5 C37 15 29 8 15.5 3.5 C18.8 6.2 20.3 8.2 21 10.2 C18.6 9.6 16.8 9.6 15.2 10.1 C18.8 11.9 21.3 13.6 22.8 15.7 C20.8 15.8 19.2 16.4 18 17.4 C22.5 18.6 26.5 21 30.5 25.5 Z" />
      </g>
    </Ornament>
  );
}

/** A calligraphic swash with two loops — the flourish under a heading. */
export function Swash({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 80 20">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path strokeWidth="0.7" d="M4 13 C9 9 14 8.5 18 10.5" />
        <path
          strokeWidth="1.3"
          d="M18 10.5 C24 13.5 28 15.5 33 13 C37 11 36 6.5 32.5 7.5 C29.5 8.5 31 13 36 13.5 C39 13.8 41 12.5 43 11 C47 8 52 7 56 9.5 C60 12 57.5 15.5 54.5 14 C52 12.7 54 9 58.5 9.5 C61 9.8 62 10.5 62 10.5"
        />
        <path strokeWidth="0.7" d="M62 10.5 C66 12.5 71 12.5 76 9" />
      </g>
    </Ornament>
  );
}

const SCROLL_DIVIDER_HALF = [
  "M80 15 C80 11 76 8 72.5 9.5 C69.5 11 70.5 15 73.5 14.5 C75.5 14 75.2 11.5 73.5 11.8",
  "M80 15 C78 17 74 18 70 16.5 C66 15 62 12 56 12 L14 12",
  "M14 12 C10 12 8 9.5 9.5 8 C11 6.5 13.5 8 12 9.5",
  "M68 8 C65 5 61 5.5 60 8 C59.3 10 61.5 11 62.8 9.6",
];

/** A long rule with curled ends and a scrolled centrepiece. */
export function ScrollDivider({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 160 20">
      <g fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
        {[undefined, "translate(160 0) scale(-1 1)"].map((transform) => (
          <g key={transform ?? "left"} transform={transform}>
            {SCROLL_DIVIDER_HALF.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        ))}
      </g>
      <path d="M80 3 L81.6 6 L80 9 L78.4 6 Z" fill="currentColor" />
    </Ornament>
  );
}

/** One quarter of the scrolled frame, mirrored into the other three. */
const SCROLL_FRAME_QUARTER = [
  "M8 100 C9.5 80 9.5 60 8 42 C7.4 32 10 25 16 23 C22 21.5 25 26 21.5 29 C18.5 31.5 15 28.5 17 26",
  "M16 23 C30 17 42 19.5 50 15.5 C55.5 12.5 54 6.5 49.5 7 C45.8 7.4 46 12 49.6 12.3",
  "M50 15.5 C57 17 63 18.5 67.5 22",
  "M67.5 22 C63 11 57 3.5 47 2 C39.5 1 37 6.5 41.5 7.6 C44.6 8.3 45.4 4.6 42.6 4.3",
  "M8 100 C4 96 2.5 90 6 86.5 C9 83.5 12.5 87 10 89.5",
  "M8.6 78 C4.5 76 3 71 5.5 68.5 C7.5 66.5 10 68.5 8.6 70.2",
];

const QUARTER_TRANSFORMS = [
  undefined,
  "translate(135 0) scale(-1 1)",
  "translate(0 200) scale(1 -1)",
  "translate(135 200) scale(-1 -1)",
];

/** A whole-page cartouche: scrolled crests top and bottom, scrolls on each side. */
export function ScrollFrame({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 135 200">
      <g fill="none" stroke="currentColor" strokeWidth="0.55" strokeLinecap="round">
        {QUARTER_TRANSFORMS.map((transform) => (
          <g key={transform ?? "top-left"} transform={transform}>
            {SCROLL_FRAME_QUARTER.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        ))}
      </g>
    </Ornament>
  );
}

/** A plain Latin cross with softly rounded ends. */
export function LatinCross({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 20 32">
      <path
        fill="currentColor"
        d="M8.3 0.6 Q10 0 11.7 0.6 L11.7 8.3 L19.4 8.3 Q20 10 19.4 11.7 L11.7 11.7 L11.7 31.4 Q10 32 8.3 31.4 L8.3 11.7 L0.6 11.7 Q0 10 0.6 8.3 L8.3 8.3 Z"
      />
    </Ornament>
  );
}

/** A Latin cross drawn in outline, its arms ending in points. */
export function OutlineCross({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 20 32">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinejoin="round"
        d="M8.6 2.4 L10 0.6 L11.4 2.4 L11.4 8.6 L17.6 8.6 L19.4 10 L17.6 11.4 L11.4 11.4 L11.4 29.2 L10 31.4 L8.6 29.2 L8.6 11.4 L2.4 11.4 L0.6 10 L2.4 8.6 L8.6 8.6 Z"
      />
    </Ornament>
  );
}

/** Where each arm of the budded cross ends, and which way it points. */
const BUD_ENDS: Array<[x: number, y: number, dx: number, dy: number]> = [
  [10, 1.9, 0, 1],
  [18.1, 10, -1, 0],
  [1.9, 10, 1, 0],
  [10, 30.1, 0, -1],
];

/** A budded (botonnée) cross — each arm ends in a trefoil of three buds. */
export function BuddedCross({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 20 32">
      <g fill="currentColor">
        <rect x="8.8" y="2.6" width="2.4" height="27" />
        <rect x="2.6" y="8.8" width="14.8" height="2.4" />
        {BUD_ENDS.map(([x, y, dx, dy]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="1.6" />
            <circle cx={x + dx * 1.7 - dy * 1.7} cy={y + dy * 1.7 - dx * 1.7} r="1.25" />
            <circle cx={x + dx * 1.7 + dy * 1.7} cy={y + dy * 1.7 + dx * 1.7} r="1.25" />
          </g>
        ))}
      </g>
    </Ornament>
  );
}

/** A Celtic cross: the ringed head, a knotwork shaft, a stepped base. */
export function CelticCross({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 20 32">
      <g stroke="currentColor">
        <circle cx="10" cy="9" r="5" fill="none" strokeWidth="1.4" />
        <path
          strokeWidth="0.6"
          fill="currentColor"
          fillOpacity="0.85"
          d="M8.4 1 H11.6 L11.2 4.6 L11.6 30.6 H8.4 L8.8 4.6 Z M1.4 7.4 L5 7.8 L8.8 7.6 L8.8 10.4 L5 10.2 L1.4 10.6 Z M18.6 7.4 L15 7.8 L11.2 7.6 L11.2 10.4 L15 10.2 L18.6 10.6 Z"
        />
        <path strokeWidth="0.8" fill="currentColor" d="M7.5 30.6 H12.5 L13 31.6 H7 Z" />
      </g>
      {/* The knotwork, picked out in the paper colour. */}
      <path
        stroke="#ffffff"
        strokeWidth="0.35"
        fill="none"
        d="M9.2 13 L10.8 15 M10.8 13 L9.2 15 M9.2 16 L10.8 18 M10.8 16 L9.2 18 M9.2 19 L10.8 21 M10.8 19 L9.2 21 M9.2 22 L10.8 24 M10.8 22 L9.2 24 M9.2 25 L10.8 27 M10.8 25 L9.2 27 M3 8.2 L5 9.8 M3 9.8 L5 8.2 M15 8.2 L17 9.8 M15 9.8 L17 8.2 M9.2 2 L10.8 4 M10.8 2 L9.2 4"
      />
      <circle cx="10" cy="9" r="1.3" fill="#ffffff" />
    </Ornament>
  );
}

/** A small knotted square, for the corners of a ruled border. */
export function CornerKnot({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 12 12">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <rect x="1.5" y="1.5" width="9" height="9" fill="#ffffff" />
        <path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" />
        <circle cx="6" cy="6" r="2" fill="#ffffff" />
      </g>
    </Ornament>
  );
}

/** A rounded corner with an inner curl and leaf — rotate it for the other corners. */
export function CornerCurl({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 12 12">
      <g fill="none" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round">
        <path d="M1 11.5 V3 Q1 1 3 1 H11.5" />
        <path d="M2.6 6 Q2.6 2.6 6 2.6 M4.2 4.2 Q5 3 6.2 3.6 Q5 4.4 4.2 4.2 Z" />
      </g>
    </Ornament>
  );
}

/** Where each heart hangs on the branch: x, y, scale, rotation. */
const BRANCH_HEARTS: Array<[number, number, number, number]> = [
  [24, 8, 1.1, 20],
  [19, 12.5, 0.9, -10],
  [3, 3, 1, -30],
  [5.5, 7.5, 0.7, 0],
  [17, 24, 2.6, 15],
  [12.5, 25.5, 0.8, 0],
  [17, 7, 0.9, 25],
  [16, 2, 0.8, 0],
  [4, 33, 1.2, -15],
];

const HEART =
  "M0 1.2 C-1.6 -0.4 -1.6 -1.8 -0.7 -2.2 C-0.3 -2.4 0 -2 0 -1.6 C0 -2 0.3 -2.4 0.7 -2.2 C1.6 -1.8 1.6 -0.4 0 1.2 Z";

/** A slender branch hung with hearts, for a page's top-left corner. */
export function HeartBranch({ size }: OrnamentProps) {
  return (
    <Ornament size={size} viewBox="0 0 40 40">
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path strokeWidth="1" d="M2 38 C6 30 8 22 9 14 C10 9 12 5 16 2" />
        <path
          strokeWidth="0.6"
          d="M8.5 18 C13 16 18 15 24 9 M9.2 12 C6 10 4 7 3 3 M7 26 C10 25 14 26 17 24 M9.8 9 C13 8 15 6 17 7"
        />
      </g>
      <g fill="currentColor">
        {BRANCH_HEARTS.map(([x, y, scale, rotate]) => (
          <path key={`${x}-${y}`} d={HEART} transform={`translate(${x} ${y}) scale(${scale}) rotate(${rotate})`} />
        ))}
      </g>
    </Ornament>
  );
}
