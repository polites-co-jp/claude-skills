<script setup>
// 階層構造。layers は上から順に並ぶ。各要素は文字列か { label, sub, accent }。
// highlight: 強調する層の番号。accent: 強調の色（既定 '1'）。
defineProps({
  layers: { type: Array, required: true },
  highlight: { type: Array, default: () => [] },
  accent: { type: String, default: '1' },
})
const norm = (it) => (typeof it === 'string' ? { label: it } : it)
</script>

<template>
  <div class="md-layer" :class="`accent-${accent}`">
    <div
      v-for="(it, i) in layers"
      :key="i"
      class="md-layer-item"
      :class="[{ 'is-hl': highlight.includes(i) }, norm(it).accent && `tint-${norm(it).accent}`]"
    >
      <div class="md-layer-label">{{ norm(it).label }}</div>
      <div v-if="norm(it).sub" class="md-layer-sub">{{ norm(it).sub }}</div>
    </div>
  </div>
</template>

<style scoped>
.md-layer { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.md-layer-item {
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  padding: var(--md-box-pad);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  font-size: var(--md-size-body);
  line-height: 1.4;
  box-sizing: border-box;
}
.md-layer-item.is-hl { border-width: var(--md-stroke-strong); font-weight: 700; }
.md-layer.accent-1 .md-layer-item.is-hl { border-color: var(--md-accent-1); }
.md-layer.accent-2 .md-layer-item.is-hl { border-color: var(--md-accent-2); }
.md-layer.accent-3 .md-layer-item.is-hl { border-color: var(--md-accent-3); }
.md-layer-item.tint-1 { background: var(--md-accent-1-tint); }
.md-layer-item.tint-2 { background: var(--md-accent-2-tint); }
.md-layer-item.tint-3 { background: var(--md-accent-3-tint); }
.md-layer-sub { font-size: var(--md-size-note); font-weight: 400; white-space: nowrap; }
</style>
