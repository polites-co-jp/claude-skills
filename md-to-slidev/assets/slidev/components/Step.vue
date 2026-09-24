<script setup>
// 工程・手順。items の各要素は文字列か { label, sub }。dir: h（横）| v（縦）。
// highlight: 強調する要素の 0 始まりの番号。accent: 強調の色（既定 '1'）。
import Arrow from './Arrow.vue'

const props = defineProps({
  items: { type: Array, required: true },
  dir: { type: String, default: 'h' },
  highlight: { type: Array, default: () => [] },
  accent: { type: String, default: '1' },
  arrow: { type: Number, default: 28 },
})
const norm = (it) => (typeof it === 'string' ? { label: it } : it)
</script>

<template>
  <div class="md-step" :class="[`dir-${dir}`, `accent-${accent}`]">
    <template v-for="(it, i) in items" :key="i">
      <Arrow v-if="i > 0" :dir="dir === 'h' ? 'right' : 'down'" :length="arrow" />
      <div class="md-step-item" :class="{ 'is-hl': highlight.includes(i) }">
        <div class="md-step-label">{{ norm(it).label }}</div>
        <div v-if="norm(it).sub" class="md-step-sub">{{ norm(it).sub }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.md-step { display: flex; align-items: center; gap: 8px; width: 100%; }
.md-step.dir-v { flex-direction: column; align-items: stretch; }
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
.md-step-item.is-hl { border-width: var(--md-stroke-strong); font-weight: 700; }
.md-step.accent-1 .md-step-item.is-hl { border-color: var(--md-accent-1); }
.md-step.accent-2 .md-step-item.is-hl { border-color: var(--md-accent-2); }
.md-step.accent-3 .md-step-item.is-hl { border-color: var(--md-accent-3); }
.md-step-sub { font-size: var(--md-size-note); font-weight: 400; margin-top: 2px; overflow-wrap: anywhere; }
</style>
