<script setup>
// 細い矢印。dir: right | down | left | up。length は px。strong で 2px。label は矢印の脇に置く短い語。
import { computed } from 'vue'

const props = defineProps({
  dir: { type: String, default: 'right' },
  length: { type: Number, default: 40 },
  strong: { type: Boolean, default: false },
  label: { type: String, default: '' },
})

const head = 8
const thick = 16
const horizontal = computed(() => props.dir === 'right' || props.dir === 'left')
const w = computed(() => (horizontal.value ? props.length : thick))
const h = computed(() => (horizontal.value ? thick : props.length))

// 線と矢じりの座標。矢じりは線の終端に開いた「く」の字。
const geom = computed(() => {
  const L = props.length
  const m = thick / 2
  switch (props.dir) {
    case 'left':
      return { line: [L, m, 0, m], head: `${head},${m - head / 2} 0,${m} ${head},${m + head / 2}` }
    case 'down':
      return { line: [m, 0, m, L], head: `${m - head / 2},${L - head} ${m},${L} ${m + head / 2},${L - head}` }
    case 'up':
      return { line: [m, L, m, 0], head: `${m - head / 2},${head} ${m},0 ${m + head / 2},${head}` }
    default:
      return { line: [0, m, L, m], head: `${L - head},${m - head / 2} ${L},${m} ${L - head},${m + head / 2}` }
  }
})
</script>

<template>
  <span class="md-arrow" :class="[`dir-${dir}`, { strong }]">
    <svg :width="w" :height="h" :viewBox="`0 0 ${w} ${h}`" aria-hidden="true">
      <line :x1="geom.line[0]" :y1="geom.line[1]" :x2="geom.line[2]" :y2="geom.line[3]" />
      <polyline :points="geom.head" />
    </svg>
    <span v-if="label" class="md-arrow-label">{{ label }}</span>
  </span>
</template>

<style scoped>
.md-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  align-self: center;
}
.md-arrow.dir-down,
.md-arrow.dir-up { flex-direction: column; }
.md-arrow svg { display: block; }
.md-arrow line,
.md-arrow polyline {
  fill: none;
  stroke: var(--md-line-strong);
  stroke-width: var(--md-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.md-arrow.strong line,
.md-arrow.strong polyline { stroke-width: var(--md-stroke-strong); }
.md-arrow-label { font-size: var(--md-size-note); white-space: nowrap; }
</style>
