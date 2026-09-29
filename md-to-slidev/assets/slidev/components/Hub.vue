<script setup>
// 中心の概念と、その周りに配置される要素（放射状の図）。
// center: 中心のラベル。items: 周囲に並べる要素。文字列か { label, sub } の配列。
// accent: 中心を強調する色（既定 '1'）。
import { computed } from 'vue'

const props = defineProps({
  center: { type: String, required: true },
  items: { type: Array, required: true },
  accent: { type: String, default: '1' },
})
const norm = (it) => (typeof it === 'string' ? { label: it } : it)

const R = 40
const positions = computed(() =>
  props.items.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / props.items.length
    return { x: 50 + R * Math.cos(angle), y: 50 + R * Math.sin(angle) }
  })
)
</script>

<template>
  <div class="md-hub" :class="`accent-${accent}`">
    <svg class="md-hub-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line v-for="(p, i) in positions" :key="i" x1="50" y1="50" :x2="p.x" :y2="p.y" />
    </svg>
    <div class="md-hub-center">{{ center }}</div>
    <div
      v-for="(it, i) in items"
      :key="i"
      class="md-hub-item"
      :style="{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }"
    >
      <div class="md-hub-item-label">{{ norm(it).label }}</div>
      <div v-if="norm(it).sub" class="md-hub-item-sub">{{ norm(it).sub }}</div>
    </div>
  </div>
</template>

<style scoped>
.md-hub { position: relative; width: 100%; aspect-ratio: 1 / 1; }
.md-hub-lines { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.md-hub-lines line { stroke: var(--md-line); stroke-width: 0.5; }
.md-hub-center,
.md-hub-item {
  position: absolute;
  transform: translate(-50%, -50%);
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  background: var(--md-bg);
  padding: var(--md-box-pad);
  text-align: center;
  font-size: var(--md-size-body);
  line-height: 1.4;
  white-space: nowrap;
  box-sizing: border-box;
}
.md-hub-center { left: 50%; top: 50%; border-width: var(--md-stroke-strong); font-weight: 500; z-index: 1; }
.md-hub.accent-1 .md-hub-center { border-color: var(--md-accent-1); background: var(--md-accent-1-tint); }
.md-hub.accent-2 .md-hub-center { border-color: var(--md-accent-2); background: var(--md-accent-2-tint); }
.md-hub.accent-3 .md-hub-center { border-color: var(--md-accent-3); background: var(--md-accent-3-tint); }
.md-hub-item-sub { font-size: var(--md-size-note); font-weight: 400; color: var(--md-muted); }
</style>
