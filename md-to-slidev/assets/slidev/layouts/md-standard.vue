<script setup>
// 標準レイアウト（2b）: 左にタイトル → 説明（default slot）＋図解（::figure::）、右の仕様欄に結論とページ数。
// ::note:: は任意。本文の一番下に、左右のカラム幅に縛られず全幅で何かを置きたいときに使う
// （EmphasisBox での強調表示や、横に広い図解など）。
// frontmatter: title, conclusion, section(任意), figureWidth(任意, 例 "40%")
import { computed, unref, useSlots } from 'vue'
import { useSlideContext } from '@slidev/client'
import MdSide from '../components/MdSide.vue'

const ctx = useSlideContext()
const slots = useSlots()
const fm = computed(() => unref(ctx.$frontmatter) || {})
const hasFigure = computed(() => !!slots.figure)
const hasNote = computed(() => !!slots.note)
const figureStyle = computed(() => (fm.value.figureWidth ? { '--md-figure-width': fm.value.figureWidth } : {}))
</script>

<template>
  <div class="slidev-layout md-sheet md-standard" :style="figureStyle">
    <div class="md-sheet-frame">
      <div class="md-main">
        <h1 class="md-title">{{ fm.title }}</h1>
        <div class="md-body">
          <div class="md-text"><slot /></div>
          <div v-if="hasFigure" class="md-figure"><slot name="figure" /></div>
        </div>
        <div v-if="hasNote" class="md-note"><slot name="note" /></div>
      </div>
      <MdSide :conclusion="fm.conclusion || ''" />
    </div>
  </div>
</template>
