<script setup>
// 仮想的な折れ線グラフ（実測値ではない、傾向を説明するための図）。
// xLabels: 横軸の区分（例 ['軽い作業', '重い作業']）。yCaption/xCaption: 軸の見出し。
// series: { label, values, accent, dash, stopAt, stopValue } の配列。values は xLabels と同じ長さの 0〜1（相対値）。dash で破線にする。
// stopAt: 線を xLabels の途中（小数の目盛り位置、例 0.5 なら1本目と2本目の中間）で打ち切りたいときの位置。stopValue はそこでの値。
// bracket: { x, label }。x の位置にある全 series の値の範囲を縦の目盛りで示す（例:「結果は同じ」）。
// points: { series, x, icon: 'ok'|'ng', label, side: 'top'|'bottom' } の配列。特定の点に丸/バツ＋短い注記を添える。
// width: CSS の幅（任意）。指定しない場合は figure の幅いっぱいに広がる。
import { computed } from 'vue'

const props = defineProps({
  xLabels: { type: Array, required: true },
  yCaption: { type: String, default: '' },
  xCaption: { type: String, default: '' },
  series: { type: Array, required: true },
  bracket: { type: Object, default: null },
  points: { type: Array, default: () => [] },
  width: { type: String, default: '' },
})

const W = 680
const H = 380
const padLeft = 56
const padRight = 40
const padTop = 48
const padBottom = 56
const plotW = W - padLeft - padRight
const plotH = H - padTop - padBottom

const colorOf = (accent) => `var(--md-accent-${accent || '1'})`
const swatchStyle = (s) => {
  const c = colorOf(s.accent)
  return s.dash
    ? { backgroundImage: `linear-gradient(to right, ${c} 60%, transparent 40%)`, backgroundSize: '8px 3px' }
    : { background: c }
}

const xAt = (i) => (props.xLabels.length > 1 ? padLeft + (i / (props.xLabels.length - 1)) * plotW : padLeft + plotW / 2)
const yAt = (v) => padTop + (1 - Math.max(0, Math.min(1, v))) * plotH
const pctX = (ux) => (ux / W) * 100
const pctY = (uy) => (uy / H) * 100

const seriesPoints = (s) => {
  const end = s.stopAt != null ? s.stopAt : props.xLabels.length - 1
  const pts = []
  for (let i = 0; i < props.xLabels.length && i <= end; i++) {
    pts.push({ x: xAt(i), y: yAt(s.values[i]) })
  }
  if (s.stopAt != null && !Number.isInteger(s.stopAt)) {
    pts.push({ x: xAt(s.stopAt), y: yAt(s.stopValue) })
  }
  return pts
}
const linePoints = (s) => seriesPoints(s).map((p) => `${p.x},${p.y}`).join(' ')
const markers = computed(() =>
  props.series.flatMap((s) => seriesPoints(s).map((p) => ({ ...p, accent: s.accent })))
)

const valueAt = (s, x) => {
  if (Number.isInteger(x) && s.values[x] !== undefined) return s.values[x]
  if (s.stopAt != null && x === s.stopAt) return s.stopValue
  return 0
}

const bracketGeom = computed(() => {
  if (!props.bracket) return null
  const vs = props.series.map((s) => s.values[props.bracket.x])
  const x = xAt(props.bracket.x) + 24
  const y1 = yAt(Math.max(...vs))
  const y2 = yAt(Math.min(...vs))
  const tick = 6
  return { x, y1, y2, tick, labelTop: pctY((y1 + y2) / 2), labelLeft: pctX(x + tick + 8) }
})

const icons = { ok: '○', ng: '×' }
const pointStyle = (p) => {
  const val = valueAt(props.series[p.series], p.x)
  const px = xAt(p.x)
  const py = yAt(val)
  const top = p.side === 'bottom' ? py + 16 : py - 16
  return {
    left: `${pctX(px)}%`,
    top: `${pctY(top)}%`,
    transform: p.side === 'bottom' ? 'translate(-100%, 0)' : 'translate(-100%, -100%)',
  }
}
</script>

<template>
  <div class="tc" :style="width ? { width } : {}">
    <div class="tc-key">
      <span v-for="(s, i) in series" :key="i" class="tc-key-item">
        <i class="tc-key-swatch" :style="swatchStyle(s)"></i>
        {{ s.label }}
      </span>
    </div>
    <div class="tc-plot" :style="{ aspectRatio: `${W} / ${H}` }">
      <svg :viewBox="`0 0 ${W} ${H}`" class="tc-svg" aria-hidden="true">
        <line class="tc-axis" :x1="padLeft" :y1="padTop - 8" :x2="padLeft" :y2="H - padBottom" />
        <line class="tc-axis" :x1="padLeft" :y1="H - padBottom" :x2="W - padRight + 8" :y2="H - padBottom" />
        <polyline
          v-for="(s, i) in series"
          :key="i"
          class="tc-line"
          :points="linePoints(s)"
          :stroke="colorOf(s.accent)"
          :stroke-dasharray="s.dash ? '8 6' : 'none'"
        />
        <circle
          v-for="(m, i) in markers"
          :key="i"
          class="tc-marker"
          :cx="m.x"
          :cy="m.y"
          r="5.5"
          :fill="colorOf(m.accent)"
        />
        <template v-if="bracketGeom">
          <line
            class="tc-bracket"
            :x1="bracketGeom.x"
            :y1="bracketGeom.y1"
            :x2="bracketGeom.x"
            :y2="bracketGeom.y2"
          />
          <line
            class="tc-bracket"
            :x1="bracketGeom.x - bracketGeom.tick"
            :y1="bracketGeom.y1"
            :x2="bracketGeom.x + bracketGeom.tick"
            :y2="bracketGeom.y1"
          />
          <line
            class="tc-bracket"
            :x1="bracketGeom.x - bracketGeom.tick"
            :y1="bracketGeom.y2"
            :x2="bracketGeom.x + bracketGeom.tick"
            :y2="bracketGeom.y2"
          />
        </template>
      </svg>
      <span
        v-for="(label, i) in xLabels"
        :key="i"
        class="tc-xlabel"
        :style="{ left: `${pctX(xAt(i))}%`, top: `${pctY(H - padBottom) + 3}%` }"
      >{{ label }}</span>
      <span
        v-if="bracketGeom"
        class="tc-bracket-label"
        :style="{ left: `${bracketGeom.labelLeft}%`, top: `${bracketGeom.labelTop}%` }"
      >{{ bracket.label }}</span>
      <span v-for="(p, i) in points" :key="i" class="tc-point-label" :style="pointStyle(p)">
        {{ icons[p.icon] }} {{ p.label }}
      </span>
      <span
        v-if="xCaption"
        class="tc-caption tc-caption-x"
        :style="{ left: `${pctX(W - padRight + 8)}%`, top: `${pctY(H - padBottom) + 3}%` }"
      >{{ xCaption }}</span>
      <span
        v-if="yCaption"
        class="tc-caption tc-caption-y"
        :style="{ left: `${pctX(padLeft)}%`, top: `${pctY(padTop - 12)}%` }"
      >{{ yCaption }}</span>
    </div>
  </div>
</template>

<style scoped>
.tc { display: flex; flex-direction: column; gap: 4px; }
.tc-key { display: flex; gap: 24px; font-size: var(--md-size-note); }
.tc-key-item { display: inline-flex; align-items: center; gap: 6px; }
.tc-key-swatch { display: inline-block; width: 22px; height: 3px; border-radius: 2px; }
.tc-caption { position: absolute; margin: 0; font-size: var(--md-size-note); color: var(--md-muted); white-space: nowrap; }
.tc-caption-x { transform: translate(-100%, 0); }
.tc-caption-y { transform: translate(0, -100%); }
.tc-plot { position: relative; width: 100%; }
.tc-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.tc-axis { stroke: var(--md-line-soft); stroke-width: 1.5; }
.tc-line { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.tc-marker { stroke: var(--md-bg); stroke-width: 2; }
.tc-bracket { stroke: var(--md-muted); stroke-width: 1.5; }
.tc-xlabel {
  position: absolute;
  transform: translate(-50%, 0);
  font-size: var(--md-size-note);
  color: var(--md-sub);
  white-space: nowrap;
}
.tc-bracket-label {
  position: absolute;
  transform: translate(0, -50%);
  font-size: var(--md-size-note);
  color: var(--md-muted);
  white-space: nowrap;
}
.tc-point-label {
  position: absolute;
  font-size: var(--md-size-note);
  color: var(--md-fg);
  font-weight: 500;
  white-space: nowrap;
}
</style>
