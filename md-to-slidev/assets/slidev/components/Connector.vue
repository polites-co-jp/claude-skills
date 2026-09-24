<script setup>
// 図形同士をつなぐ線（矢じりなし）。dir: h | v。length は px。label は線の脇の短い語。
defineProps({
  dir: { type: String, default: 'h' },
  length: { type: Number, default: 40 },
  strong: { type: Boolean, default: false },
  label: { type: String, default: '' },
})
</script>

<template>
  <span class="md-connector" :class="[`dir-${dir}`, { strong }]">
    <svg
      :width="dir === 'h' ? length : 16"
      :height="dir === 'h' ? 16 : length"
      :viewBox="`0 0 ${dir === 'h' ? length : 16} ${dir === 'h' ? 16 : length}`"
      aria-hidden="true"
    >
      <line v-if="dir === 'h'" x1="0" y1="8" :x2="length" y2="8" />
      <line v-else x1="8" y1="0" x2="8" :y2="length" />
    </svg>
    <span v-if="label" class="md-connector-label">{{ label }}</span>
  </span>
</template>

<style scoped>
.md-connector {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  align-self: center;
}
.md-connector.dir-v { flex-direction: column; }
.md-connector svg { display: block; }
.md-connector line {
  stroke: var(--md-line-strong);
  stroke-width: var(--md-stroke);
  stroke-linecap: round;
}
.md-connector.strong line { stroke-width: var(--md-stroke-strong); }
.md-connector-label { font-size: var(--md-size-note); white-space: nowrap; }
</style>
