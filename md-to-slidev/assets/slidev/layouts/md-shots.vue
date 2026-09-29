<script setup>
// 画像ギャラリー（2b派生）: 左にタイトル → 説明（default slot、任意）、その下に画像（::figure:: の中に Shot を並べる）を
// 横並びで大きく表示、右の仕様欄に結論とページ数。説明が短くても画像が残りの縦幅いっぱいまで大きく表示される。
// ::note:: は任意。本文の一番下に強調表示を置きたいときに使う（EmphasisBox を中に置く）。
// frontmatter: title, conclusion, section(任意)
import { computed, unref, useSlots } from 'vue'
import { useSlideContext } from '@slidev/client'
import MdSide from '../components/MdSide.vue'

const ctx = useSlideContext()
const slots = useSlots()
const fm = computed(() => unref(ctx.$frontmatter) || {})
const hasText = computed(() => !!slots.default)
const hasFigure = computed(() => !!slots.figure)
const hasNote = computed(() => !!slots.note)
</script>

<template>
  <div class="slidev-layout md-sheet md-shots">
    <div class="md-sheet-frame">
      <div class="md-main">
        <h1 class="md-title">{{ fm.title }}</h1>
        <div class="md-body md-shots-body">
          <div v-if="hasText" class="md-text md-shots-text"><slot /></div>
          <div v-if="hasFigure" class="md-figure md-shots-figure"><slot name="figure" /></div>
        </div>
        <div v-if="hasNote" class="md-note"><slot name="note" /></div>
      </div>
      <MdSide :conclusion="fm.conclusion || ''" />
    </div>
  </div>
</template>

<style scoped>
.md-shots-body {
  flex-direction: column;
  min-height: 0;
}
.md-shots-text {
  flex: 0 0 auto;
}
.md-shots-figure {
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: row;
  align-items: stretch;
  gap: var(--md-gap-columns);
}
.md-shots-figure :deep(> *) {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
}
</style>
