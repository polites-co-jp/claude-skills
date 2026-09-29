<script setup>
// システム構成などの概念図。同じ図を段階的に更新して使い回すための部品。
// chain: 上から下へつながる要素の配列。各要素は文字列か { label, sub, children: [...] }。
//   children を持つ要素は、その右側に子要素が扇状に並ぶ（ツール群など）。
// tags: { ノードのラベル: [短い語...] }。ノードの左脇に付く印（後から足す仕組みの名前など）。
//   chain を組み直さずに「ここに何が付くか」を重ねるときに使う。
// highlight: 強調する要素のラベルの配列（今回の話題の場所）。子要素・tags の語も指定できる。
// overlay: { label, items: [ラベル...] } で、指定した要素に薄い下地を敷き、その範囲の名前を右上に示す。
//   「この範囲を X が担う」のような重ね合わせに使う。子要素・tags の語も指定できる。
// accent: 強調と overlay の色。
import { computed } from 'vue'
import Arrow from './Arrow.vue'
import Connector from './Connector.vue'

const props = defineProps({
  chain: { type: Array, required: true },
  tags: { type: Object, default: () => ({}) },
  highlight: { type: Array, default: () => [] },
  overlay: { type: Object, default: null },
  accent: { type: String, default: '1' },
  arrow: { type: Number, default: 24 },
})
const norm = (it) => (typeof it === 'string' ? { label: it } : it)
const isHl = (label) => props.highlight.includes(label)
const inOverlay = (label) => !!props.overlay && (props.overlay.items || []).includes(label)
const nodes = computed(() => props.chain.map(norm))
const tagsOf = (label) => props.tags[label] || []
const isTall = (i) => (nodes.value[i].children || []).length > 1
</script>

<template>
  <div class="md-arch" :class="`accent-${accent}`">
    <span v-if="overlay" class="md-arch-overlay-label">
      <span class="md-arch-swatch"></span>{{ overlay.label }}
    </span>
    <template v-for="(n, i) in nodes" :key="i">
      <!-- 子要素のある行は背が高いので、行の上端までは線だけを引き、矢じりはノードの直前に置く -->
      <Connector v-if="i > 0 && isTall(i)" class="md-arch-link" dir="v" :length="arrow" />
      <Arrow v-else-if="i > 0" class="md-arch-link" dir="down" :length="arrow" />
      <div class="md-arch-row">
        <div v-if="tagsOf(n.label).length" class="md-arch-tags">
          <span
            v-for="(t, j) in tagsOf(n.label)"
            :key="j"
            class="md-arch-tag"
            :class="{ 'is-hl': isHl(t), 'in-overlay': inOverlay(t) }"
          >{{ t }}</span>
          <svg class="md-arch-tie" width="20" height="16" viewBox="0 0 20 16" aria-hidden="true"><line x1="0" y1="8" x2="20" y2="8" /></svg>
        </div>
        <div class="md-arch-stem">
          <span class="md-arch-seg" :class="{ 'is-line': i > 0 && isTall(i) }"></span>
          <svg v-if="i > 0 && isTall(i)" class="md-arch-head" width="16" height="8" viewBox="0 0 16 8" aria-hidden="true"><polyline points="4,0 8,8 12,0" /></svg>
          <div class="md-arch-node" :class="{ 'is-hl': isHl(n.label), 'in-overlay': inOverlay(n.label) }">
            <div>{{ n.label }}</div>
            <div v-if="n.sub" class="md-arch-sub">{{ n.sub }}</div>
          </div>
          <span class="md-arch-seg" :class="{ 'is-line': i < nodes.length - 1 && isTall(i) }"></span>
        </div>
        <div v-if="n.children && n.children.length" class="md-arch-side">
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
.md-arch-child,
.md-arch-tag {
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  box-sizing: border-box;
  background: var(--md-bg);
}
.md-arch-node {
  padding: 6px 18px;
  font-size: var(--md-size-body);
  line-height: 1.4;
  text-align: center;
  min-width: 220px;
  white-space: nowrap;
}
.md-arch-child { min-width: 150px; white-space: nowrap; height: 36px; padding: 0 14px; display: flex; align-items: center; justify-content: center; font-size: var(--md-size-note); }
.md-arch-tag { font-size: var(--md-size-note); line-height: 1.3; padding: 2px 10px; white-space: nowrap; }
.md-arch-sub { font-size: var(--md-size-note); }
/* 左右の列を常に同じ幅にして、本体の列を図の中心に固定する。子要素のある行だけ右が広くても
   本体がずれず、行間の矢印（図の中心に置かれる）と縦の線がつながる。はみ出す側は列の外へ出す */
.md-arch-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  width: 100%;
}
.md-arch-row > .md-arch-stem { grid-column: 2; }
.md-arch-stem { align-self: stretch; display: flex; flex-direction: column; align-items: center; }
.md-arch-seg { flex: 1 1 0; width: 0; }
.md-arch-seg.is-line { border-left: var(--md-stroke) solid var(--md-line-strong); }
.md-arch-head { display: block; flex: 0 0 auto; margin-top: -8px; }
.md-arch-head polyline { fill: none; stroke: var(--md-line-strong); stroke-width: var(--md-stroke); stroke-linecap: round; stroke-linejoin: round; }
.md-arch-row > .md-arch-tags { grid-column: 1; }
.md-arch-row > .md-arch-side { grid-column: 3; }
.md-arch-tags { display: flex; align-items: center; justify-self: end; gap: 6px; }
.md-arch-tie { display: block; flex: 0 0 auto; margin-left: 2px; }
.md-arch-tie line { stroke: var(--md-line-strong); stroke-width: var(--md-stroke); }
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
/* 図の上に1行ぶん確保して置く（重ねると最上段のノードに被るため） */
.md-arch-overlay-label {
  align-self: flex-end;
  margin-bottom: 8px;
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
