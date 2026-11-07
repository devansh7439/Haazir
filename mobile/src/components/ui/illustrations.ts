// The app's drawings, as SVG text. Each one shows something that really happens in Haazir (a phone calling three hospitals at
// once, a bed held with a timer, nobody picking up, an empty list), in one hand: a bold ink outline whose corners wander a little,
// and a flat colour fill laid down slightly off the outline, like a two-colour print. No gradients, no glow, no stock shapes.
// Lines are `ink`, the offset shapes are `fill`, windows and screens are `paper`, and `accent` is the one spot of crimson.

export type IllustrationName = 'calls' | 'hold' | 'none' | 'empty' | 'search';
export type IllustrationTone = 'dark' | 'light';

type Palette = { ink: string; fill: string; paper: string; accent: string; spot: string };

// `dark` is for white or grey pages. `light` is for the crimson hero: white lines, a darker crimson for the offset fills.
const PALETTE: Record<IllustrationTone, Palette> = {
  dark: { ink: '#1F1A1C', fill: '#EBDCC9', paper: '#FFFFFF', accent: '#D42E45', spot: '#D42E45' },
  light: { ink: '#FFFFFF', fill: '#A81F35', paper: '#C42A40', accent: '#FFE3E7', spot: '#FFE3E7' },
};

const W = 240;
const H = 160;

// A small steady wobble, so a drawing is the same every time it is drawn but no corner is exactly where a ruler would put it.
function wobbler(seed: number) {
  let s = seed * 9301 + 49297;
  return (amount: number) => {
    s = (s * 9301 + 49297) % 233280;
    return (s / 233280 - 0.5) * 2 * amount;
  };
}

const n = (v: number) => Math.round(v * 10) / 10;

/** A rounded box drawn by hand: each corner is nudged and the sides bow very slightly. */
function box(x: number, y: number, w: number, h: number, r: number, jig: (a: number) => number): string {
  const x0 = x + jig(0.7);
  const y0 = y + jig(0.7);
  const x1 = x + w + jig(0.7);
  const y1 = y + h + jig(0.7);
  const x2 = x + w + jig(0.7);
  const y2 = y + jig(0.7);
  const x3 = x + jig(0.7);
  const y3 = y + h + jig(0.7);
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M${n(x0 + rr)} ${n(y0)}`,
    `Q${n(x + w / 2)} ${n(y0 + jig(0.9))} ${n(x2 - rr)} ${n(y2)}`,
    `Q${n(x2)} ${n(y2)} ${n(x2)} ${n(y2 + rr)}`,
    `Q${n(x2 + jig(0.9))} ${n(y + h / 2)} ${n(x1)} ${n(y1 - rr)}`,
    `Q${n(x1)} ${n(y1)} ${n(x1 - rr)} ${n(y1)}`,
    `Q${n(x + w / 2)} ${n(y1 + jig(0.9))} ${n(x3 + rr)} ${n(y3)}`,
    `Q${n(x3)} ${n(y3)} ${n(x3)} ${n(y3 - rr)}`,
    `Q${n(x0 + jig(0.9))} ${n(y + h / 2)} ${n(x0)} ${n(y0 + rr)}`,
    `Q${n(x0)} ${n(y0)} ${n(x0 + rr)} ${n(y0)}Z`,
  ].join('');
}

const OFFSET = 3.2;

function drawing(p: Palette, body: (draw: Draw) => string): string {
  const stroke = `fill="none" stroke="${p.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`;
  const draw: Draw = {
    // A shape with its colour laid down off to one side and its outline on top. White shapes (screens, windows) are drawn in place.
    solid: (d, color = p.fill) =>
      color === p.paper
        ? `<path d="${d}" fill="${color}" ${stroke.replace('fill="none" ', '')}/>`
        : `<path d="${d}" fill="${color}" transform="translate(${OFFSET} ${OFFSET})"/><path d="${d}" ${stroke}/>`,
    line: (d, width = 2.6) => `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    dashed: (d) => `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.5 7"/>`,
    spot: (d) => `<path d="${d}" fill="${p.spot}"/>`,
    paper: (d) => `<path d="${d}" fill="${p.paper}" stroke="${p.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    ink: (d) => `<path d="${d}" fill="${p.ink}"/>`,
    p,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${body(draw)}</svg>`;
}

type Draw = {
  solid: (d: string, color?: string) => string;
  line: (d: string, width?: number) => string;
  dashed: (d: string) => string;
  spot: (d: string) => string;
  paper: (d: string) => string;
  ink: (d: string) => string;
  p: Palette;
};

/** A hospital seen from the front: a block with a crimson cross over the door and four small windows. */
function hospital(d: Draw, jig: (a: number) => number, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cross = 4.5;
  const top = y + 9;
  const win = Math.max(5, w * 0.15);
  const rowY = y + h * 0.56;
  return [
    d.solid(box(x, y, w, h, 3, jig)),
    // the cross, two bars
    d.spot(`M${n(cx - 1.8)} ${n(top - cross)}h3.6v${n(cross * 2)}h-3.6z`),
    d.spot(`M${n(cx - cross)} ${n(top - 1.8)}h${n(cross * 2)}v3.6h${n(-cross * 2)}z`),
    d.paper(box(x + w * 0.16, rowY - win / 2, win, win, 1, jig)),
    d.paper(box(x + w * 0.84 - win, rowY - win / 2, win, win, 1, jig)),
    // the door
    d.paper(box(cx - w * 0.1, y + h - h * 0.26, w * 0.2, h * 0.26, 1.5, jig)),
  ].join('');
}

const SCENES: Record<IllustrationName, (d: Draw) => string> = {
  // A phone and three hospitals, joined by dotted lines: Haazir phones every capable hospital at once.
  calls: (d) => {
    const j = wobbler(3);
    return [
      // the ring marks beside the phone
      d.line('M14 30c-5 5-5 12 0 17', 2.2),
      d.line('M8 24c-9 9-9 22 0 31', 2.2),
      // lines from the phone to each hospital
      d.dashed('M70 70C96 62 108 36 142 30'),
      d.dashed('M70 80C108 80 140 82 170 82'),
      d.dashed('M70 90C96 100 108 124 142 130'),
      // the phone
      d.solid(box(24, 38, 46, 86, 9, j)),
      d.paper(box(30, 48, 34, 60, 3, j)),
      d.ink('M43 41.5a2 2 0 1 1 4 0a2 2 0 1 1-4 0z'),
      // three calls on its screen, the middle one answered
      d.spot('M34 59a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0z'),
      d.line('M45 59h14', 2.2),
      d.spot('M34 77a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0z'),
      d.line('M45 77h10', 2.2),
      d.spot('M34 95a3.5 3.5 0 1 1 7 0a3.5 3.5 0 1 1-7 0z'),
      d.line('M45 95h13', 2.2),
      hospital(d, j, 146, 8, 40, 38),
      hospital(d, j, 176, 62, 44, 42),
      hospital(d, j, 146, 114, 40, 38),
    ].join('');
  },

  // A bed with a tag tied to its footboard: a bed held until a time.
  hold: (d) => {
    const j = wobbler(11);
    return [
      d.line('M14 130H226', 2.4),
      // legs
      d.line('M54 112v18'),
      d.line('M178 112v18'),
      // headboard and footboard
      d.solid(box(36, 58, 12, 72, 4, j)),
      d.solid(box(180, 80, 10, 50, 4, j)),
      // mattress
      d.solid(box(46, 94, 138, 20, 6, j)),
      // pillow
      d.paper(box(52, 76, 38, 18, 8, j)),
      // blanket with its fold
      d.solid(box(96, 80, 84, 18, 6, j), d.p.spot),
      d.line('M104 89h62', 1.8),
      // the tag on its string
      d.line('M185 86C200 84 208 90 206 98', 2),
      d.solid(box(193, 98, 28, 30, 5, j), d.p.paper),
      d.ink('M204.6 102.5a2.2 2.2 0 1 1 4.4 0a2.2 2.2 0 1 1-4.4 0z'),
      // a clock on the tag
      d.paper('M199 116a8 8 0 1 1 16 0a8 8 0 1 1-16 0z'),
      d.line('M207 116v-4', 1.8),
      d.line('M207 116l3.5 2', 1.8),
    ].join('');
  },

  // A hospital with every window dark, and a call that stops before it gets there.
  none: (d) => {
    const j = wobbler(5);
    return [
      d.line('M14 138H226', 2.4),
      // the hospital, windows filled in: no bed
      d.solid(box(120, 26, 92, 112, 4, j)),
      d.spot('M162.2 38h3.6v18h-3.6z'),
      d.spot('M153 45.2h22v3.6h-22z'),
      d.ink(box(132, 70, 14, 14, 1.5, j)),
      d.ink(box(158, 70, 14, 14, 1.5, j)),
      d.ink(box(184, 70, 14, 14, 1.5, j)),
      d.ink(box(132, 96, 14, 14, 1.5, j)),
      d.ink(box(158, 96, 14, 14, 1.5, j)),
      d.ink(box(184, 96, 14, 14, 1.5, j)),
      d.paper(box(157, 116, 20, 22, 2, j)),
      // the phone, off to the left, and the call that falls short
      d.solid(box(22, 70, 36, 68, 8, j)),
      d.paper(box(27, 80, 26, 44, 2, j)),
      d.dashed('M64 92C78 84 90 82 100 86'),
      // the break: a small cross where it ends
      d.line('M104 80l9 12', 2.6),
      d.line('M113 80l-9 12', 2.6),
    ].join('');
  },

  // A clipboard with nothing written, and a pencil laid on it.
  empty: (d) => {
    const j = wobbler(7);
    return [
      d.solid(box(70, 20, 90, 118, 8, j)),
      d.paper(box(80, 36, 70, 94, 3, j)),
      d.solid(box(99, 12, 32, 18, 5, j), d.p.spot),
      // lines where a name and a case would go, left blank
      d.dashed('M90 58H138'),
      d.dashed('M90 74H138'),
      d.dashed('M90 90H124'),
      // a pencil across the corner
      d.solid('M150 118l32-30 8 8-32 30-12 4z', d.p.paper),
      d.spot('M150 118l-4 12 12-4z'),
      d.line('M176 82l8 8', 2.2),
    ].join('');
  },

  // A magnifying glass over a hospital row, finding nothing.
  search: (d) => {
    const j = wobbler(9);
    return [
      d.line('M14 138H226', 2.4),
      // two hospitals, and the glass between them over nothing
      d.solid(box(26, 76, 46, 62, 3, j)),
      d.paper(box(36, 90, 8, 8, 1, j)),
      d.paper(box(54, 90, 8, 8, 1, j)),
      d.paper(box(42, 116, 14, 22, 1.5, j)),
      d.solid(box(188, 98, 36, 40, 3, j)),
      d.paper(box(195, 110, 7, 7, 1, j)),
      d.paper(box(210, 110, 7, 7, 1, j)),
      d.line('M142 92l18 22', 5),
      d.solid('M82 62a34 34 0 1 1 68 0a34 34 0 1 1-68 0z', d.p.paper),
      d.line('M94 54c3-9 11-14 19-14', 2.2),
    ].join('');
  },
};

/** The SVG text of a drawing, in the colours of a page (`dark`) or of the crimson hero (`light`). */
export function illustrationXml(name: IllustrationName, tone: IllustrationTone = 'dark'): string {
  return drawing(PALETTE[tone], SCENES[name]);
}

export const ILLUSTRATION_RATIO = H / W;
