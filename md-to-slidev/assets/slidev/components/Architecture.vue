<script setup>
// システム構成などの概念図。同じ図を段階的に更新して使い回すための部品。
// chain: 上から下へつながる要素の配列。各要素は文字列か { label, sub, children: [...] }。
//   children を持つ要素は、その右側に子要素が扇状に並ぶ（ツール群など）。
// highlight: 強調する要素のラベルの配列（今回の話題の場所）。
// overlay: { label, items: [ラベル...] } で、指定した要素に薄い下地を敷き、その範囲の名前を右上に示す。
//   「この範囲を X が担う」のような重ね合わせに使う。
// accent: 強調と overlay の色。
import { computed } from 'vue'
import Arrow from './Arrow.vue'
import Branch from './Branch.vue'

const props = defineProps({
  chain: { type: Array, required: true },
  highlight: { type: Array, default: () => [] },
  overlay: { type: Object, default: null },
  accent: { type: String, default: '1' },
  arrow: { type: Number, default: 24 },
})
const norm = (it) => (typeof it === 'string' ? { label: it } : it)
const isHl = (label) => props.highlight.includes(label)
const inOverlay = (label) => !!props.overlay && (props.overlay.items || []).includes(label)
const nodes = computed(() => props.chain.map(norm))
</script>

<template>
  <div class="md-arch" :class="`accent-${accent}`">
    <span v-if="overlay" class="md-arch-overlay-label">
      <span class="md-arch-swatch"></span>{{ overlay.label }}
    </span>
    <template v-for="(n, i) in nodes" :key="i">
      <Arrow v-if="i > 0" dir="down" :length="arrow" />
      <div v-if="n.children && n.children.length" class="md-arch-row">
        <div class="md-arch-node" :class="{ 'is-hl': isHl(n.label), 'in-overlay': inOverlay(n.label) }">
          <div>{{ n.label }}</div>
          <div v-if="n.sub" class="md-arch-sub">{{ n.sub }}</div>
        </div>
        <div class="md-arch-side">
          <svg class="md-arch-fan" :width="40" :height="n.children.length * 44 - 8" :viewBox="`0 0 40 ${n.children.length * 44 - 8}`" aria-hidden="true">
            <template v-for="(_, j) in n.children" :key="j">
              <path :d="`M0,${(n.children.length * 44 - 8) / 2} H20 V${j * 44 + 18} H34`" />
            </template>
          </svg>
          <div class="md-arch-children">
            <div
              v-for="(c, j) in n.children"
              :key="j"
              class="md-arch-child"
              :class="{ 'is-hl': isHl(c), 'in-overlay': inOverlay(c) }"
            >{{ c }}</div>
          </div>
        </div>
      </div>
      <div v-else class="md-arch-node" :class="{ 'is-hl': isHl(n.label), 'in-overlay': inOverlay(n.label) }">
        <div>{{ n.label }}</div>
        <div v-if="n.sub" class="md-arch-sub">{{ n.sub }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.md-arch {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.md-arch-node,
.md-arch-child {
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  padding: 6px 18px;
  font-size: var(--md-size-body);
  line-height: 1.4;
  text-align: center;
  min-width: 220px;
  box-sizing: border-box;
  background: var(--md-bg);
}
.md-arch-child { min-width: 180px; height: 36px; padding: 0 14px; display: flex; align-items: center; justify-content: center; font-size: var(--md-size-note); }
.md-arch-sub { font-size: var(--md-size-note); }
.md-arch-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr; /* 中央の列に本体を置き、図の軸に揃える。子要素は右の列に */
  align-items: center;
  width: 100%;
}
.md-arch-row > .md-arch-node { grid-column: 2; }
.md-arch-row > .md-arch-side { grid-column: 3; }
.md-arch-side { display: flex; align-items: center; justify-self: start; }
.md-arch-fan { display: block; flex: 0 0 auto; }
.md-arch-fan path {
  fill: none;
  stroke: var(--md-line-strong);
  stroke-width: var(--md-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.md-arch-children { display: flex; flex-direction: column; gap: 8px; }
.is-hl { border-width: var(--md-stroke-strong); font-weight: 700; }
.md-arch.accent-1 .is-hl { border-color: var(--md-accent-1); }
.md-arch.accent-2 .is-hl { border-color: var(--md-accent-2); }
.md-arch.accent-3 .is-hl { border-color: var(--md-accent-3); }
.md-arch.accent-1 .in-overlay { background: var(--md-accent-1-tint); }
.md-arch.accent-2 .in-overlay { background: var(--md-accent-2-tint); }
.md-arch.accent-3 .in-overlay { background: var(--md-accent-3-tint); }
.md-arch-overlay-label {
  position: absolute;
  top: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--md-size-note);
}
.md-arch-swatch {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: var(--md-stroke) solid var(--md-line);
}
.md-arch.accent-1 .md-arch-swatch { background: var(--md-accent-1-tint); }
.md-arch.accent-2 .md-arch-swatch { background: var(--md-accent-2-tint); }
.md-arch.accent-3 .md-arch-swatch { background: var(--md-accent-3-tint); }
</style>
