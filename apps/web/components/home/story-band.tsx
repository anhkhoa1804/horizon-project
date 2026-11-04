import { cn } from "@/lib/utils";

/**
 * Washes behind the quotes: a few soft blots of paint, their edges broken up by an SVG turbulence
 * filter so they read as watercolour / brush rather than gradients. Each quote gets its own seed
 * and arrangement. Colours come from CSS variables so dark mode can mute them.
 */
const WASHES = [
  [{ cx: 300, cy: 150, rx: 260, ry: 95, c: "a" }, { cx: 520, cy: 170, rx: 200, ry: 80, c: "b" }],
  [{ cx: 480, cy: 140, rx: 270, ry: 90, c: "b" }, { cx: 260, cy: 175, rx: 180, ry: 70, c: "c" }],
  [{ cx: 400, cy: 150, rx: 300, ry: 85, c: "a" }, { cx: 600, cy: 120, rx: 140, ry: 60, c: "c" }],
  [{ cx: 340, cy: 160, rx: 240, ry: 90, c: "c" }, { cx: 540, cy: 140, rx: 220, ry: 85, c: "a" }],
] as const;

/**
 * One line of the story, set large and centred on the page - no box, no source line, no highlight -
 * over a faint paint wash. `variant` picks the wash.
 */
export function StoryQuote({ text, variant = 0, className }: { text: string; variant?: number; className?: string }) {
  const wash = WASHES[variant % WASHES.length];
  const id = `quote-wash-${variant}`;
  return (
    <blockquote className={cn("story-quote", className)}>
      <svg className="story-quote__wash" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden focusable="false">
        <defs>
          <filter id={id} x="-20%" y="-30%" width="140%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.028" numOctaves="3" seed={7 + variant * 13} />
            <feDisplacementMap in="SourceGraphic" scale="70" />
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g filter={`url(#${id})`}>
          {wash.map((b, i) => (
            <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} style={{ fill: `var(--wash-${b.c})` }} />
          ))}
        </g>
      </svg>
      <p>{text}</p>
    </blockquote>
  );
}
