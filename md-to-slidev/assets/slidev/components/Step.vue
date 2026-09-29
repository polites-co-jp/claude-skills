<script setup>
// 工程・手順。items の各要素は文字列か { label, sub }。dir: h（横）| v（縦）。
// highlight: 強調する要素の 0 始まりの番号。accent: 強調の色（既定 '1'）。
// loop: 手前の工程へ戻る矢印。{ from, to, label? }（0始まりの番号。from の下から to の下へ弧を描く）。
import { computed, nextTick, onBeforeUpdate, onMounted, onUnmounted, ref } from 'vue'
import Arrow from './Arrow.vue'

const props = defineProps({
  items: { type: Array, required: true },
  dir: { type: String, default: 'h' },
  highlight: { type: Array, default: () => [] },
  accent: { type: String, default: '1' },
  arrow: { type: Number, default: 28 },
  loop: { type: Object, default: null },
})
const norm = (it) => (typeof it === 'string' ? { label: it } : it)

const rootEl = ref(null)
const itemEls = ref([])
onBeforeUpdate(() => { itemEls.value = [] })
const setItemEl = (el, i) => { if (el) itemEls.value[i] = el }

const dip = 44
const loopGeom = ref(null)

const measure = () => {
  if (!props.loop || !rootEl.value) { loopGeom.value = null; return }
  const fromEl = itemEls.value[props.loop.from]
  const toEl = itemEls.value[props.loop.to]
  if (!fromEl || !toEl) { loopGeom.value = null; return }
  const rootRect = rootEl.value.getBoundingClientRect()
  // Slidev はスライド全体を transform: scale で縮小表示するため、画面上の座標を
  // スライド内の座標（SVG の座標系）に戻す。
  const scale = rootRect.width / rootEl.value.offsetWidth || 1
  const fromRect = fromEl.getBoundingClientRect()
  const toRect = toEl.getBoundingClientRect()
  const fx = (fromRect.left + fromRect.width / 2 - rootRect.left) / scale
  const fy = (fromRect.bottom - rootRect.top) / scale
  const tx = (toRect.left + toRect.width / 2 - rootRect.left) / scale
  const ty = (toRect.bottom - rootRect.top) / scale
  const headLen = 10
  loopGeom.value = {
    path: `M ${fx},${fy} C ${fx},${fy + dip} ${tx},${ty + dip} ${tx},${ty + headLen}`,
    head: `${tx - 6},${ty + headLen} ${tx},${ty} ${tx + 6},${ty + headLen}`,
    labelX: (fx + tx) / 2,
    labelY: fy + dip + 18,
  }
}

let ro
onMounted(async () => {
  await nextTick()
  measure()
  ro = new ResizeObserver(() => measure())
  if (rootEl.value) ro.observe(rootEl.value)
  itemEls.value.forEach((el) => el && ro.observe(el))
})
onUnmounted(() => {
  if (ro) ro.disconnect()
})

const hasLoop = computed(() => !!props.loop)
</script>

<template>
  <div ref="rootEl" class="md-step" :class="[`dir-${dir}`, `accent-${accent}`, { 'has-loop': hasLoop }]">
    <template v-for="(it, i) in items" :key="i">
      <Arrow v-if="i > 0" :dir="dir === 'h' ? 'right' : 'down'" :length="arrow" />
      <div
        :ref="(el) => setItemEl(el, i)"
        class="md-step-item"
        :class="{ 'is-hl': highlight.includes(i) }"
      >
        <div class="md-step-label">{{ norm(it).label }}</div>
        <div v-if="norm(it).sub" class="md-step-sub">{{ norm(it).sub }}</div>
      </div>
    </template>
    <svg v-if="loopGeom" class="md-step-loop" aria-hidden="true">
      <path :d="loopGeom.path" />
      <polygon :points="loopGeom.head" />
      <text v-if="loop.label" :x="loopGeom.labelX" :y="loopGeom.labelY" text-anchor="middle">{{ loop.label }}</text>
    </svg>
  </div>
</template>

<style scoped>
.md-step { position: relative; display: flex; align-items: center; gap: 8px; width: 100%; }
.md-step.dir-v { flex-direction: column; align-items: stretch; }
.md-step.has-loop { padding-bottom: 64px; }
.md-step-item {
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  padding: var(--md-box-pad);
  text-align: center;
  font-size: var(--md-size-body);
  line-height: 1.4;
  box-sizing: border-box;
}
.md-step.dir-h .md-step-item { flex: 1 1 0; min-width: 0; }
.md-step-item.is-hl { border-width: var(--md-stroke-strong); font-weight: 500; background: var(--md-accent-1-tint); }
.md-step.accent-1 .md-step-item.is-hl { border-color: var(--md-accent-1); }
.md-step.accent-2 .md-step-item.is-hl { border-color: var(--md-accent-2); }
.md-step.accent-3 .md-step-item.is-hl { border-color: var(--md-accent-3); }
.md-step-sub { font-size: var(--md-size-note); font-weight: 400; margin-top: 2px; color: var(--md-muted); overflow-wrap: anywhere; }
.md-step-loop { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.md-step-loop path { fill: none; stroke: var(--md-muted); stroke-width: var(--md-stroke); stroke-linecap: round; }
.md-step-loop polygon { fill: var(--md-muted); }
.md-step-loop text { font-size: var(--md-size-note); fill: var(--md-muted); }
</style>
