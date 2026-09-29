<script setup>
// 全面レイアウト（2b）: 左にタイトル → 全幅の本文（大きな比較表など）、右の仕様欄に結論とページ数。
// frontmatter: title, conclusion, section(任意)
import { computed, unref } from 'vue'
import { useSlideContext } from '@slidev/client'
import MdSide from '../components/MdSide.vue'

const ctx = useSlideContext()
const fm = computed(() => unref(ctx.$frontmatter) || {})
</script>

<template>
  <div class="slidev-layout md-sheet md-wide">
    <div class="md-sheet-frame">
      <div class="md-main">
        <h1 class="md-title">{{ fm.title }}</h1>
        <div class="md-body">
          <div class="md-wide-body"><slot /></div>
        </div>
      </div>
      <MdSide :conclusion="fm.conclusion || ''" />
    </div>
  </div>
</template>

<style scoped>
.md-wide-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--md-gap-item);
}
</style>
