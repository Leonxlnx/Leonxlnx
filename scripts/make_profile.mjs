// Generates every SVG the profile README uses: the hero that lints itself, the project tiles and
// the sponsor row. All text is outlined, so nothing depends on the viewer's fonts, and everything
// animates with CSS or SMIL, which GitHub leaves alone inside an <img>.
//
//   cd scripts && npm install && node make_profile.mjs
//
// Numbers go stale, so they live here. Change them and run it again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'assets', 'profile');
const CACHE = path.join(HERE, '.cache');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

const STATS = { taste: '107k', installs: '5.2M', tastecode: '433', earshot: '3.4k', cinetic: '945' };
const RAW = 'https://raw.githubusercontent.com/Leonxlnx';

const font = (pkg, file) => {
  const b = fs.readFileSync(path.join(HERE, 'node_modules', '@fontsource', pkg, 'files', file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const SANS = font('geist-sans', 'geist-sans-latin-500-normal.woff');
const BOLD = font('geist-sans', 'geist-sans-latin-600-normal.woff');
const MONO = font('geist-mono', 'geist-mono-latin-500-normal.woff');

// Outlined text. `track` is letter spacing in px, `anchor` is start, middle or end.
const width = (f, s, size, track = 0) => f.getAdvanceWidth(s, size) + track * (s.length - 1);
function d(f, s, x, y, size, { anchor = 'start', track = 0 } = {}) {
  const w = width(f, s, size, track);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return f.getPath(s, x0, y, size, { letterSpacing: track / size }).toPathData(size > 30 ? 1 : 2);
}
const text = (f, s, x, y, size, fill, o = {}) => `<path fill="${fill}" d="${d(f, s, x, y, size, o)}"${o.cls ? ` class="${o.cls}"` : ''}/>`;

// A timeline on one clock. Each element gets its own @keyframes, written in seconds.
function clock(T) {
  const rules = [];
  let n = 0;
  return {
    css: () => rules.join(''),
    // stops: [[seconds, {o, t}, easing?], ...]; the element holds its first and last stop.
    anim(stops, extra = '') {
      const id = `a${n++}`;
      const frames = stops.map(([t, p, ease]) => {
        const body = [p.o !== undefined && `opacity:${p.o}`, p.t && `transform:${p.t}`, ease && `animation-timing-function:${ease}`].filter(Boolean).join(';');
        return `${+(t / T * 100).toFixed(3)}%{${body}}`;
      });
      const first = stops[0][1];
      const last = stops[stops.length - 1][1];
      if (stops[0][0] > 0) frames.unshift(`0%{${first.o !== undefined ? `opacity:${first.o};` : ''}${first.t ? `transform:${first.t}` : ''}}`);
      frames.push(`100%{${last.o !== undefined ? `opacity:${last.o};` : ''}${last.t ? `transform:${last.t}` : ''}}`);
      rules.push(`@keyframes ${id}{${frames.join('')}}.${id}{animation:${id} ${T}s linear both;${extra}}`);
      return id;
    },
  };
}

const OUT_EASE = 'cubic-bezier(.2,.8,.2,1)';
const IN_EASE = 'cubic-bezier(.6,0,.9,.3)';

/* ------------------------------------------------------------------ hero */

// A terminal in the style of a coding agent CLI. It opens on a warp through ASCII stars with a
// torus knot rushing up out of the depth, then the welcome panel draws itself and the knot lands
// in it, where it keeps turning. The resting state is the finished terminal.

const ART = { cols: 40, rows: 18, size: 9.6, frames: 60, loop: 5 };
const RAMP = '.,-~:;=!*#$@';

function knotFrames() {
  const { cols, rows, frames } = ART;
  const aspect = 0.6; // a Geist Mono cell is 0.6em wide and 1em tall here
  const p = 2, q = 3, tube = 0.42, K2 = 7.2, K1 = 15.4;
  const curve = (t) => {
    const r = Math.cos(q * t) + 2.1;
    return [r * Math.cos(p * t), r * Math.sin(p * t), -Math.sin(q * t) * 1.15];
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (v) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // Sample the tube once, with a Frenet frame along the curve.
  const pts = [];
  const U = 1500, V = 44, e = 1e-3;
  for (let i = 0; i < U; i++) {
    const t = (i / U) * Math.PI * 2;
    const c = curve(t);
    const T = norm(sub(curve(t + e), curve(t - e)));
    const T2 = norm(sub(curve(t + 2 * e), c));
    const N = norm(sub(T2, T));
    const B = cross(T, N);
    for (let j = 0; j < V; j++) {
      const a = (j / V) * Math.PI * 2;
      const n = [N[0] * Math.cos(a) + B[0] * Math.sin(a), N[1] * Math.cos(a) + B[1] * Math.sin(a), N[2] * Math.cos(a) + B[2] * Math.sin(a)];
      pts.push([c[0] + tube * n[0], c[1] + tube * n[1], c[2] + tube * n[2], ...n]);
    }
  }

  const light = norm([-0.4, 0.8, -1]);
  const out = [];
  // The knot maps onto itself after a third of a turn about its axis, so spinning 120 degrees
  // per loop is seamless; tilt and yaw wobble on the same period to show its depth.
  for (let f = 0; f < frames; f++) {
    const A = (f / frames) * Math.PI * 2;
    const spin = A / 3, tilt = 0.62 + 0.28 * Math.sin(A), yaw = 0.38 * Math.sin(A + 1.2);
    const [cs, ss, ct, st, cy, sy] = [Math.cos(spin), Math.sin(spin), Math.cos(tilt), Math.sin(tilt), Math.cos(yaw), Math.sin(yaw)];
    const rot = (x, y, z) => {
      const x1 = x * cs - y * ss, y1 = x * ss + y * cs; // spin about the knot's axis
      const y2 = y1 * ct - z * st, z2 = y1 * st + z * ct; // tilt about x
      return [x1 * cy + z2 * sy, y2, -x1 * sy + z2 * cy]; // yaw about y
    };
    const zbuf = new Float32Array(cols * rows);
    const chars = new Array(cols * rows).fill(' ');
    for (const [x, y, z, nx, ny, nz] of pts) {
      const [X, Y, Z] = rot(x, y, z);
      const ooz = 1 / (Z + K2);
      const col = Math.round(cols / 2 + (K1 * X * ooz) / aspect);
      const row = Math.round(rows / 2 - K1 * Y * ooz);
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const k = row * cols + col;
      if (ooz <= zbuf[k]) continue;
      zbuf[k] = ooz;
      const [NX, NY, NZ] = rot(nx, ny, nz);
      const lum = NX * light[0] + NY * light[1] + NZ * light[2];
      chars[k] = RAMP[Math.min(RAMP.length - 1, Math.floor(((lum + 1) / 2) ** 1.6 * RAMP.length))];
    }
    const lines = [];
    for (let r = 0; r < rows; r++) lines.push(chars.slice(r * cols, (r + 1) * cols).join(''));
    out.push(lines);
  }
  return out;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tone = (ch) => ('.,-~'.includes(ch) ? 'd' : ':;=!'.includes(ch) ? 'm' : 'h');

// One frame as one <text>: each line starts at its first character, runs of a tone share a tspan.
function frameText(lines, cls, style) {
  const { size } = ART;
  const adv = size * 0.6;
  let body = '';
  lines.forEach((line, r) => {
    const lead = line.length - line.trimStart().length;
    const s = line.trim();
    if (!s) return;
    let runs = '', cur = null, buf = '';
    for (const ch of s) {
      const t = ch === ' ' ? cur : tone(ch);
      if (t !== cur && buf) { runs += `<tspan class="${cur}">${esc(buf)}</tspan>`; buf = ''; }
      cur = t; buf += ch;
    }
    if (buf) runs += `<tspan class="${cur}">${esc(buf)}</tspan>`;
    body += `<tspan x="${(lead * adv).toFixed(1)}" y="${((r + 1) * size - 2).toFixed(1)}">${runs}</tspan>`;
  });
  return `<text class="${cls}"${style ? ` style="${style}"` : ''}>${body}</text>`;
}

function hero() {
  const W = 846, H = 378, L = 5, R = 841, TOP = 30;
  const c = clock(5);
  const C = { screen: '#0c0c0c', bar: '#161616', ink: '#ededed', soft: '#a1a1a1', dim: '#6b6b6b', line: '#3a3a3a' };
  const mono = (s) => fs.readFileSync(path.join(HERE, 'node_modules', '@fontsource', 'geist-mono', 'files', `geist-mono-latin-${s}-normal.woff2`)).toString('base64');
  const BOX = { x: 24, y: 46, w: 798, h: 248 };
  const DIV = 330;
  const show = (at, from = 'translateY(4px)') => c.anim([[at, { o: 0, t: from }, 'cubic-bezier(.2,.8,.2,1)'], [at + 0.22, { o: 1, t: 'none' }]]);
  const t = (x, y, s, fill, size = 13, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"${extra}>${esc(s)}</text>`;

  // Art: frames swap on a loop that starts at load and never stops.
  const frames = knotFrames();
  const dt = ART.loop / ART.frames;
  const art = frames.map((lines, i) => frameText(lines, i ? 'f' : 'f f0', `animation-delay:${(-(ART.loop - i * dt)).toFixed(3)}s`)).join('');
  const artW = ART.cols * ART.size * 0.6, artH = ART.rows * ART.size;
  const small = 1, big = 1.8, cx = W / 2, cy = (H + 8) / 2;
  const slotX = BOX.x + (DIV - BOX.x) / 2 - (artW * small) / 2, slotY = BOX.y + 40;
  const at = (x, y, s) => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s})`;
  const centre = at(cx - (artW * big) / 2, cy - (artH * big) / 2, big);
  const deep = at(cx - (artW * 0.04) / 2, cy - (artH * 0.04) / 2, 0.04);
  const land = at(slotX, slotY, small);
  const knot = c.anim([
    [0.45, { o: 0, t: deep }, 'cubic-bezier(.16,1,.3,1)'],
    [1.7, { o: 1, t: centre }],
    [3.2, { o: 1, t: centre }, 'cubic-bezier(.7,0,.25,1)'],
    [3.95, { o: 1, t: land }],
  ], 'transform-origin:0 0');

  // Warp: characters streaming out of the centre, turned along their path and stretched as they
  // pass, so the dashes read as streaks.
  let rnd = 7;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  let stars = '', starCss = '';
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2, reach = 360 + rand() * 260;
    const dx = Math.cos(a) * reach, dy = Math.sin(a) * reach * 0.62;
    const deg = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(0);
    const dur = 0.5 + rand() * 0.55, delay = 0.1 + rand() * dur;
    const streak = i % 3 !== 0;
    const ch = streak ? '-' : ['.', '+', '*'][i % 9 === 0 ? 2 : i % 2];
    const end = streak ? 'scale(5,1.1)' : 'scale(2.4)';
    starCss += `@keyframes w${i}{0%{opacity:0;transform:translate(${cx}px,${cy}px) rotate(${deg}deg) scale(.3)}30%{opacity:1}100%{opacity:0;transform:translate(${(cx + dx).toFixed(0)}px,${(cy + dy).toFixed(0)}px) rotate(${deg}deg) ${end}}}.w${i}{animation:w${i} ${dur.toFixed(2)}s cubic-bezier(.6,0,1,.5) ${delay.toFixed(2)}s ${Math.ceil((3.1 - delay) / dur)} both}`;
    stars += `<text class="w${i}" font-size="14" text-anchor="middle" fill="${i % 4 ? C.soft : C.ink}">${ch}</text>`;
  }
  const warp = c.anim([[0, { o: 1 }], [2.8, { o: 1 }], [3.2, { o: 0 }]]);

  // Window chrome.
  const chrome = c.anim([[2.85, { o: 0 }], [3.15, { o: 1 }]]);
  const dots = [0, 1, 2].map((i) => `<circle cx="${L + 20 + i * 18}" cy="15" r="5.5" fill="#3a3a3a"/>`).join('');
  const titlebar = `<g class="${chrome}"><path d="M${L} 12a12 12 0 0 1 12-12h${R - L - 24}a12 12 0 0 1 12 12v${TOP - 12}H${L}z" fill="${C.bar}"/>${dots}${t(W / 2, 19.5, '~/Leonxlnx', C.dim, 12, ' text-anchor="middle"')}</g>`;

  // Welcome panel, its border drawn in.
  const label = 'Leonxlnx';
  const labelW = label.length * 13 * 0.6 + 14;
  const panel = `<rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" rx="8" fill="none" stroke="${C.line}" stroke-width="1.2" pathLength="1" class="dr"/>
<g class="${show(3.55, 'none')}"><rect x="${BOX.x + 14}" y="${BOX.y - 8}" width="${labelW}" height="16" fill="${C.screen}"/>${t(BOX.x + 21, BOX.y + 4.5, label, C.soft, 13)}</g>
<path d="M${DIV} ${BOX.y + 22}V${BOX.y + BOX.h - 22}" stroke="${C.line}" stroke-width="1.2" class="${show(3.6, 'scaleY(0)')}" style="transform-origin:${DIV}px ${BOX.y + BOX.h / 2}px"/>`;

  // Left column: name above the knot, the folder below it.
  const leftMid = BOX.x + (DIV - BOX.x) / 2;
  const left = `<g class="${show(3.9)}">${t(leftMid, BOX.y + 30, 'Leon Lin', C.ink, 14.5, ' text-anchor="middle" font-weight="700"')}</g>
<g class="${show(4.0)}">${t(leftMid, BOX.y + BOX.h - 18, 'Munich, Germany', C.dim, 12.5, ' text-anchor="middle"')}</g>`;

  // Right column: what he does, the tools, where to find him.
  const RX = DIV + 24;
  const rows = [
    ['About', 'h'],
    ['Builds tools for AI coding agents.', 'b'],
    ['Renders worlds, films and sound in code.', 'b'],
    [null, 'rule'],
    ['Stack', 'h'],
    ['TypeScript · three.js · WebGPU · GLSL · Python', 's'],
    [null, 'gap'],
    ['Elsewhere', 'h'],
    ['leonlin.de · x.com/lexnlin · hello@tasteskill.dev', 's'],
  ];
  let y = BOX.y + 34, right = '';
  rows.forEach(([s, kind], i) => {
    const when = 3.95 + i * 0.055;
    if (kind === 'rule') { right += `<path d="M${RX} ${y - 6}H${BOX.x + BOX.w - 24}" stroke="${C.line}" stroke-width="1" class="${show(when, 'scaleX(0)')}" style="transform-origin:${RX}px 0"/>`; y += 22; return; }
    if (kind === 'gap') { y += 8; return; }
    const fill = kind === 'h' ? C.ink : kind === 'b' ? C.soft : C.soft;
    right += `<g class="${show(when)}">${t(RX, y, s, fill, 13, kind === 'h' ? ' font-weight="700"' : '')}</g>`;
    y += kind === 'h' ? 22 : 20;
  });

  // Prompt box with the cursor waiting and a suggestion, the way the CLI greets you.
  const PY = BOX.y + BOX.h + 14, PH = 38;
  const prompt = `<g class="${show(4.45)}"><rect x="${BOX.x}" y="${PY}" width="${BOX.w}" height="${PH}" rx="6" fill="none" stroke="#575757" stroke-width="1.2"/>
${t(BOX.x + 14, PY + 24, '>', C.ink, 13.5)}<rect x="${BOX.x + 32}" y="${PY + 12}" width="8.1" height="16" fill="${C.ink}" class="bl"/>
${t(BOX.x + 44, PY + 24, 'Try "render a storm over open water"', C.dim, 13.5)}</g>
<g class="${show(4.6)}">${t(BOX.x + 14, PY + PH + 18, '? for shortcuts', C.dim, 12)}</g>`;

  const css = `
@font-face{font-family:GM;font-weight:500;src:url(data:font/woff2;base64,${mono(500)}) format('woff2')}
@font-face{font-family:GM;font-weight:700;src:url(data:font/woff2;base64,${mono(700)}) format('woff2')}
text{font-family:GM,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:500;white-space:pre}
.d{fill:#4d4d4d}.m{fill:#9b9b9b}.h{fill:#f4f4f4}
.f{font-size:${ART.size}px;opacity:0;animation:fr ${ART.loop}s step-end infinite}.f0{opacity:1}
@keyframes fr{0%{opacity:1}${(100 / ART.frames).toFixed(3)}%{opacity:0}100%{opacity:0}}
.dr{stroke-dasharray:1;animation:dr .8s cubic-bezier(.65,0,.35,1) 3.05s both}@keyframes dr{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.bl{animation:bl 1.05s steps(1) infinite}@keyframes bl{50%{opacity:0}}
${starCss}${c.css()}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.intro{display:none}}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="A terminal styled like a coding agent CLI. Welcome panel for Leon Lin, Munich, with a spinning ASCII torus knot. About: builds tools for AI coding agents and renders worlds, films and sound in code. Stack: TypeScript, three.js, WebGPU, GLSL, Python.">
<title>Leon Lin</title>
<defs><clipPath id="win"><rect x="${L}" y="0" width="${R - L}" height="${H - 4}" rx="12"/></clipPath></defs>
<style>${css.replace(/\n/g, '')}</style>
<rect x="${L}" y="0" width="${R - L}" height="${H - 4}" rx="12" fill="${C.screen}"/>
<g clip-path="url(#win)">
<g class="intro ${warp}">${stars}</g>
${panel}
<g class="${knot}" style="transform:${land};transform-origin:0 0">${art}</g>
${titlebar}${left}${right}${prompt}
</g>
</svg>`;
}

/* ----------------------------------------------------------------- tiles */

async function raw(url) {
  const file = path.join(CACHE, url.replace(/[^a-z0-9.]+/gi, '_').slice(-80));
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return fs.readFileSync(file);
}

// Each source is { url, page?, crop?: [left, top, width, height], pos? }, scaled to w x h at 2x.
async function still(src, w, h, quality = 68) {
  let img = sharp(await raw(src.url), src.page !== undefined ? { page: src.page } : {});
  if (src.crop) img = img.extract({ left: src.crop[0], top: src.crop[1], width: src.crop[2], height: src.crop[3] });
  img = img.resize(w * 2, h * 2, { fit: 'cover', position: src.pos ?? 'centre' });
  const out = await img.webp({ quality }).toBuffer();
  return `data:image/webp;base64,${out.toString('base64')}`;
}

const INK = '#0e0e0e', SOFT = '#a3a3a3';

function star(x, y, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + q * Math.cos(a)).toFixed(2)},${(y + q * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}

// Slideshow inside a tile. `cut` is a hard film cut, otherwise frames dissolve.
function slideshow(images, w, h, { hold = 3, fade = 0.9, cut = false } = {}) {
  const n = images.length;
  const cycle = cut ? hold * n : (hold + fade) * n;
  let css = '', out = '';
  images.forEach((img, i) => {
    const pct = (s) => +(s / cycle * 100).toFixed(3);
    if (i > 0) {
      const a = i * (cut ? hold : hold + fade);
      const start = cut ? a : a - fade;
      const end = cut ? a + hold : a + hold;
      const f = cut
        ? `0%,${pct(a) - 0.001}%{opacity:0}${pct(a)}%,${pct(end) - 0.001}%{opacity:1}${pct(end)}%,100%{opacity:0}`
        : `0%,${pct(start)}%{opacity:0}${pct(a)}%,${pct(end)}%{opacity:1}${pct(Math.min(end + fade, cycle))}%,100%{opacity:${i === n - 1 ? 1 : 0}}`;
      css += `@keyframes s${i}{${f}}.s${i}{animation:s${i} ${cycle}s linear infinite}`;
    }
    out += `<image href="${img}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"${i ? ` class="s${i}"` : ''}/>`;
  });
  return { css, out };
}

function tile({ w, h, plate, name, desc, right, sub, title, big }) {
  return ({ css = '', art }) => {
    const gx = 5, tw = w - gx * 2, th = h - 4, ih = th - plate;
    const nameSize = big ? 21 : 16.5, descSize = big ? 13.5 : 12.5, pad = big ? 16 : 13;
    const y1 = ih + (big ? 25 : 22), y2 = ih + (big ? 44 : 40);
    const rx = tw - pad;
    let side = '';
    if (right?.star) {
      const s = width(BOLD, right.star, nameSize - 3);
      side += text(BOLD, right.star, rx, y1 - 0.5, nameSize - 3, '#fff', { anchor: 'end' }) + star(rx - s - 9, y1 - 5.5, 5.6, '#fff');
    } else if (right?.label) {
      side += text(SANS, right.label, rx, y1 - 0.5, descSize, SOFT, { anchor: 'end' });
    }
    if (sub) side += text(SANS, sub, rx, y2, descSize, SOFT, { anchor: 'end' });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
<title>${title}</title><defs><clipPath id="c"><rect width="${tw}" height="${th}" rx="14"/></clipPath></defs>
<style>${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<g transform="translate(${gx} 0)" clip-path="url(#c)"><rect width="${tw}" height="${th}" fill="${INK}"/>${art(tw, ih)}
${text(BOLD, name, pad, y1, nameSize, '#fff', { track: -0.2 })}${text(SANS, desc, pad, y2, descSize, SOFT)}${side}</g>
</svg>`;
  };
}

/* -------------------------------------------------------------- sponsors */

function logoData(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

async function sponsorChip({ name, desc, logo, title }, theme) {
  const ink = theme === 'dark' ? '#efebe2' : '#0a0a0a';
  const soft = theme === 'dark' ? '#a8a49b' : '#5c5c5c';
  const w = 211, h = 52;
  const nameX = 5 + 44 + 11;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
<title>${title}</title><defs><clipPath id="c"><rect x="5" y="4" width="44" height="44" rx="11"/></clipPath></defs>
<image href="${logo[theme] ?? logo.any}" x="5" y="4" width="44" height="44" clip-path="url(#c)"/>
${text(BOLD, name, nameX, 24, 15, ink)}${text(SANS, desc, nameX, 41, 12.5, soft)}
</svg>`;
}

/* ------------------------------------------------------------------ main */

const write = (name, svg) => {
  const clean = svg.replace(/\n/g, '');
  fs.writeFileSync(path.join(OUT, name), clean);
  console.log(name.padEnd(28), `${(Buffer.byteLength(clean) / 1024).toFixed(0)} KB`);
};

write('hero.svg', hero());

const work = (f) => `${RAW}/leons-demos/main/public/work/${f}`;
const BIG = { w: 423, h: 192, plate: 58, big: true };
const SMALL = { w: 211, h: 140, plate: 54, big: false };
const IMG_BIG = [BIG.w - 10, BIG.h - 4 - BIG.plate];
const IMG_SMALL = [SMALL.w - 10, SMALL.h - 4 - SMALL.plate];

// Taste Skill: three real pages it built, dissolving.
{
  const frames = await Promise.all(['taste-nachtschicht.webp', 'taste-roast.webp', 'taste-storefront.webp'].map((f) => still({ url: work(f), pos: 'top' }, ...IMG_BIG, 66)));
  const s = slideshow(frames, ...IMG_BIG, { hold: 3.2 });
  write('tile-taste-skill.svg', tile({ ...BIG, name: 'Taste Skill', desc: 'Anti-slop frontend rules for AI agents', right: { star: STATS.taste }, sub: 'tasteskill.dev', title: `Taste Skill, anti-slop frontend rules for AI agents. ${STATS.taste} stars. tasteskill.dev` })({ css: s.css, art: () => s.out }));
}

// TasteCode: the app's sidebar, one project's chats run by Claude Code, Codex and Grok.
{
  const f = await still({ url: work('tastecode-app.webp'), crop: [0, 352, 880, 303] }, ...IMG_BIG, 80);
  write('tile-tastecode.svg', tile({ ...BIG, name: 'TasteCode', desc: 'A new home for your coding agents', right: { star: STATS.tastecode }, sub: 'tastecode.dev', title: `TasteCode, a new home for your coding agents. ${STATS.tastecode} stars. tastecode.dev` })({ art: (w, h) => `<image href="${f}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` }));
}

// earshot: frames from the launch film, cut like the film.
{
  const url = `${RAW}/earshot/main/docs/media/launch_frames.png`;
  const cell = (c, r) => ({ url, crop: [c * 483 + 2, Math.round(r * 272.67) + 2, 479, 268] });
  const frames = await Promise.all([cell(1, 0), cell(2, 0), cell(3, 1), cell(0, 2), cell(2, 2)].map((x) => still(x, ...IMG_SMALL, 62)));
  const s = slideshow(frames, ...IMG_SMALL, { hold: 1.4, cut: true });
  write('tile-earshot.svg', tile({ ...SMALL, name: 'earshot', desc: 'Ears for coding agents', right: { star: STATS.earshot }, title: `earshot, ears for coding agents. ${STATS.earshot} stars.` })({ css: s.css, art: () => s.out }));
}

// cinetic: a launch film it directed.
{
  const url = `${RAW}/cinetic/media/kiln-launch-teaser.gif`;
  const frames = await Promise.all([12, 61, 111, 148, 185].map((page) => still({ url, page }, ...IMG_SMALL, 62)));
  const s = slideshow(frames, ...IMG_SMALL, { hold: 1.4, cut: true });
  write('tile-cinetic.svg', tile({ ...SMALL, name: 'cinetic', desc: 'Launch films from code', right: { star: STATS.cinetic }, title: `cinetic, launch films from code. ${STATS.cinetic} stars.` })({ css: s.css, art: () => s.out }));
}

// cook: the reference and what the agent rendered, wiped across each other.
{
  const url = `${RAW}/athenaion/main/media/reference_vs_render.jpg`;
  const row = 450 * 4; // Parthenon front, the fifth pair
  const ref = await still({ url, crop: [0, row, 800, 450] }, ...IMG_SMALL, 62);
  const ren = await still({ url, crop: [800, row, 800, 450] }, ...IMG_SMALL, 62);
  const [w, h] = IMG_SMALL;
  const vals = `0;0;${w};${w};0`, times = '0;.12;.5;.62;1', spl = '.7 0 .2 1;.7 0 .2 1;.7 0 .2 1;.7 0 .2 1';
  const art = () => `<image href="${ref}" width="${w}" height="${h}"/><clipPath id="w"><rect width="0" height="${h}"><animate attributeName="width" dur="7s" repeatCount="indefinite" calcMode="spline" values="${vals}" keyTimes="${times}" keySplines="${spl}"/></rect></clipPath><image href="${ren}" width="${w}" height="${h}" clip-path="url(#w)"/><rect width="2" height="${h}" fill="#fff"><animate attributeName="x" dur="7s" repeatCount="indefinite" calcMode="spline" values="${vals}" keyTimes="${times}" keySplines="${spl}"/></rect>`;
  write('tile-cook.svg', tile({ ...SMALL, name: 'cook', desc: 'A target, a bar and time', right: { label: 'new' }, title: 'cook, give your agent a target, a bar and time. An AI reference image wipes into the render it built.' })({ art }));
}

// Demos: worlds rendered from code, no assets.
{
  const sources = [
    `${RAW}/open-water/main/media/golden-hour.jpg`,
    `${RAW}/procedural-fire/main/docs/preview.jpg`,
    `${RAW}/golden-temple/main/docs/images/hero.jpg`,
    `${RAW}/napali/main/media/04_valley.jpg`,
    `${RAW}/athenaion/main/media/shot1.jpg`,
  ];
  const frames = await Promise.all(sources.map((url) => still({ url }, ...IMG_SMALL, 62)));
  const s = slideshow(frames, ...IMG_SMALL, { hold: 2.2, fade: 0.8 });
  write('tile-demos.svg', tile({ ...SMALL, name: 'Demos', desc: 'Worlds and films from code', right: { label: 'leonlin.de' }, title: 'Demos, worlds and films rendered from code. leonlin.de' })({ css: s.css, art: () => s.out }));
}

// Sponsors.
const S = `${RAW}/taste-skill/main/assets/sponsors`;
const svgLogo = async (f) => `data:image/svg+xml;base64,${(await raw(`${S}/${f}`)).toString('base64')}`;
const pngLogo = async (f) => `data:image/png;base64,${(await sharp(await raw(`${S}/${f}`)).resize(96, 96, { fit: 'contain', background: '#ffffff' }).png().toBuffer()).toString('base64')}`;
const sponsors = [
  { id: 'interfaces', name: 'interfaces.dev', desc: 'Design magazine', title: 'interfaces.dev, a design engineering magazine', logo: { any: await pngLogo('interfaces-dev-icon.webp') } },
  { id: 'reactbits', name: 'React Bits', desc: 'React components', title: 'React Bits, animated React components', logo: { light: await svgLogo('reactbits-icon-light.svg'), dark: await svgLogo('reactbits-icon-dark.svg') } },
  { id: 'imgly', name: 'IMG.LY', desc: 'Creative SDKs', title: 'IMG.LY, creative editing SDKs', logo: { any: await svgLogo('imgly-logo.svg') } },
  { id: 'sentdm', name: 'Sent.dm', desc: 'Messaging API', title: 'Sent.dm, messaging API for SMS, WhatsApp and RCS', logo: { any: await pngLogo('sentdm.png') } },
];
for (const s of sponsors) for (const theme of ['light', 'dark']) write(`sponsor-${s.id}-${theme}.svg`, await sponsorChip(s, theme));
