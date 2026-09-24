<script setup>
// 1つの要素から複数へ分岐する構造。from（起点）→ to（分岐先の配列。文字列か { label, sub, tag }）。
// tag は分岐先の脇に置く短いラベル（条件など）。row: 分岐先1行の高さ px。highlight: 強調する分岐先の番号。
const props = defineProps({
  from: { type: String, required: true },
  to: { type: Array, required: true },
  row: { type: Number, default: 64 },
  gap: { type: Number, default: 12 },
  highlight: { type: Array, default: () => [] },
  accent: { type: String, default: '1' },
})
const norm = (it) => (typeof it === 'string' ? { label: it } : it)
const width = 56
const height = () => props.to.length * props.row + (props.to.length - 1) * props.gap
const centerY = (i) => i * (props.row + props.gap) + props.row / 2
const path = (i) => {
  const mid = height() / 2
  const y = centerY(i)
  return `M0,${mid} H${width / 2} V${y} H${width - 8}`
}
const head = (i) => {
  const y = centerY(i)
  return `${width - 14},${y - 4} ${width - 8},${y} ${width - 14},${y + 4}`
}
</script>

<template>
  <div class="md-branch" :class="`accent-${accent}`">
    <div class="md-branch-from">{{ from }}</div>
    <svg class="md-branch-lines" :width="width" :height="height()" :viewBox="`0 0 ${width} ${height()}`" aria-hidden="true">
      <template v-for="(_, i) in to" :key="i">
        <path :d="path(i)" />
        <polyline :points="head(i)" />
      </template>
    </svg>
    <div class="md-branch-to" :style="{ gap: `${gap}px` }">
      <div
        v-for="(it, i) in to"
        :key="i"
        class="md-branch-item"
        :class="{ 'is-hl': highlight.includes(i) }"
        :style="{ height: `${row}px` }"
      >
        <div class="md-branch-text">
          <div class="md-branch-label">{{ norm(it).label }}</div>
          <div v-if="norm(it).sub" class="md-branch-sub">{{ norm(it).sub }}</div>
        </div>
        <span v-if="norm(it).tag" class="md-branch-tag">{{ norm(it).tag }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.md-branch { display: flex; align-items: center; }
.md-branch-from,
.md-branch-item {
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  padding: var(--md-box-pad);
  font-size: var(--md-size-body);
  line-height: 1.4;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.md-branch-from { justify-content: center; text-align: center; flex: 0 0 auto; }
.md-branch-lines { flex: 0 0 auto; display: block; }
.md-branch-lines path,
.md-branch-lines polyline {
  fill: none;
  stroke: var(--md-line-strong);
  stroke-width: var(--md-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.md-branch-to { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.md-branch-item.is-hl { border-width: var(--md-stroke-strong); font-weight: 700; }
.md-branch.accent-1 .md-branch-item.is-hl { border-color: var(--md-accent-1); }
.md-branch.accent-2 .md-branch-item.is-hl { border-color: var(--md-accent-2); }
.md-branch.accent-3 .md-branch-item.is-hl { border-color: var(--md-accent-3); }
.md-branch-sub { font-size: var(--md-size-note); font-weight: 400; }
.md-branch-tag {
  font-size: var(--md-size-note);
  font-weight: 400;
  white-space: nowrap;
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  padding: 0 8px;
}
</style>
