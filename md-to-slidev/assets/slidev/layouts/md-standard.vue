<script setup>
// 標準レイアウト: タイトル → 結論 → 左に説明（default slot）、右に図解（::figure::）。
// frontmatter: title, conclusion, section(任意), figureWidth(任意, 例 "40%")
import { computed, unref, useSlots } from 'vue'
import { useSlideContext } from '@slidev/client'
import MdFooter from '../components/MdFooter.vue'

const ctx = useSlideContext()
const slots = useSlots()
const fm = computed(() => unref(ctx.$frontmatter) || {})
const hasFigure = computed(() => !!slots.figure)
const figureStyle = computed(() => (fm.value.figureWidth ? { '--md-figure-width': fm.value.figureWidth } : {}))
</script>

<template>
  <div class="slidev-layout md-standard" :style="figureStyle">
    <h1 class="md-title">{{ fm.title }}</h1>
    <p v-if="fm.conclusion" class="md-conclusion">{{ fm.conclusion }}</p>
    <div class="md-body">
      <div class="md-text"><slot /></div>
      <div v-if="hasFigure" class="md-figure"><slot name="figure" /></div>
    </div>
    <MdFooter />
  </div>
</template>
