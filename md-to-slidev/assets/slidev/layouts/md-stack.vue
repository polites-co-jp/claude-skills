<script setup>
// 上下レイアウト（2b）: 左にタイトル → 説明（default slot）、その下に図解（::figure::）を横並び、右の仕様欄に結論とページ数。
// 図解の直下の要素（Group など）は等幅で横に並ぶ。比べたい図を2〜3つ並べるときに使う。
// frontmatter: title, conclusion, section(任意)
import { computed, unref, useSlots } from 'vue'
import { useSlideContext } from '@slidev/client'
import MdSide from '../components/MdSide.vue'

const ctx = useSlideContext()
const slots = useSlots()
const fm = computed(() => unref(ctx.$frontmatter) || {})
const hasFigure = computed(() => !!slots.figure)
</script>

<template>
  <div class="slidev-layout md-sheet md-stack">
    <div class="md-sheet-frame">
      <div class="md-main">
        <h1 class="md-title">{{ fm.title }}</h1>
        <div class="md-body md-stack-body">
          <div class="md-text"><slot /></div>
          <div v-if="hasFigure" class="md-figure md-stack-figure"><slot name="figure" /></div>
        </div>
      </div>
      <MdSide :conclusion="fm.conclusion || ''" />
    </div>
  </div>
</template>

<style scoped>
.md-stack-body { flex-direction: column; }
.md-stack-body .md-text { flex: 0 0 auto; }
.md-stack-figure {
  flex: 0 0 auto;
  flex-direction: row;
  align-items: stretch;
  gap: var(--md-gap-columns);
}
.md-stack-figure :deep(> *) { flex: 1 1 0; min-width: 0; }
</style>
