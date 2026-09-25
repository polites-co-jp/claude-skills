// Shared helpers for the slide-design-review scripts. No dependencies beyond Node.js itself;
// Slidev and Playwright are resolved from the user's Slidev project (or the global npm root).
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Directory names the scripts never touch or snapshot.
export const LOG_DIR = 'design-review';
export const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', LOG_DIR, '.slidev', '.vite', '.cache', '.turbo']);

export function die(message, code = 1) {
  console.error(message);
  process.exit(code);
}

// Nearest directory at or above `start` whose package.json depends on @slidev/cli.
export function findSlidevRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const json = JSON.parse(fs.readFileSync(pkg, 'utf8'));
        const deps = { ...json.dependencies, ...json.devDependencies };
        if (deps['@slidev/cli']) return dir;
      } catch { /* unreadable package.json: keep walking */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function globalNodeModules() {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Resolve a module the way Slidev's exporter does: project first, then the global npm root.
export function resolveFrom(root, specifier, { global = false } = {}) {
  try {
    return createRequire(path.join(root, 'package.json')).resolve(specifier);
  } catch { /* fall through */ }
  if (!global) return null;
  const g = globalNodeModules();
  if (!g) return null;
  try {
    return createRequire(path.join(g, 'noop.js')).resolve(specifier);
  } catch {
    return null;
  }
}

export function pad(n, width) {
  return String(n).padStart(width, '0');
}

// Page file name used everywhere: page-07.png (3 digits when the deck has 100+ pages).
export function pageFile(n, total) {
  return `page-${pad(n, total >= 100 ? 3 : 2)}.png`;
}

export function listPageFiles(dir) {
  if (!fs.existsSync(dir)) return new Map();
  const out = new Map();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^page-(\d+)\.png$/);
    if (m) out.set(Number(m[1]), path.join(dir, f));
  }
  return out;
}

// Minimal PNG decoder: 8-bit, non-interlaced, color types 0/2/3/4/6 (what browsers write for screenshots).
// Returns { width, height, bpp, data } with unfiltered scanlines, or null when the format is not supported.
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8;
  let width = 0, height = 0, depth = 0, color = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      depth = body[8]; color = body[9]; interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  if (depth !== 8 || interlace !== 0 || !channels) return null;
  const bpp = channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = data.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[x] = v & 0xff;
    }
  }
  return { width, height, bpp, data };
}

// Compare two PNG buffers. Returns { status: 'same' | 'changed', ratio, bbox, note }.
export function comparePng(bufA, bufB) {
  if (bufA.equals(bufB)) return { status: 'same' };
  const a = decodePng(bufA), b = decodePng(bufB);
  if (!a || !b) return { status: 'changed', note: 'PNG の形式が未対応のため、変化の範囲は出せない' };
  if (a.width !== b.width || a.height !== b.height) {
    return { status: 'changed', note: `寸法が変わった（${a.width}x${a.height} → ${b.width}x${b.height}）` };
  }
  if (a.bpp !== b.bpp) return { status: 'changed', note: '色形式が変わった' };
  let count = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * a.bpp;
      let diff = false;
      for (let c = 0; c < a.bpp; c++) if (a.data[i + c] !== b.data[i + c]) { diff = true; break; }
      if (diff) {
        count++;
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
    }
  }
  if (count === 0) return { status: 'same', note: 'エンコードだけが異なり、画素は同じ' };
  return { status: 'changed', ratio: count / (a.width * a.height), bbox: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}
