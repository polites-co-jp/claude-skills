<script setup>
// 全面レイアウト: タイトル → 結論 → 全幅の本文（全面図解・大きな比較表など）。
// frontmatter: title, conclusion, section(任意)
import { computed, unref } from 'vue'
import { useSlideContext } from '@slidev/client'
import MdFooter from '../components/MdFooter.vue'

const ctx = useSlideContext()
const fm = computed(() => unref(ctx.$frontmatter) || {})
</script>

<template>
  <div class="slidev-layout md-wide">
    <h1 class="md-title">{{ fm.title }}</h1>
    <p v-if="fm.conclusion" class="md-conclusion">{{ fm.conclusion }}</p>
    <div class="md-body">
      <div class="md-wide-body"><slot /></div>
    </div>
    <MdFooter />
  </div>
</template>

<style scoped>
.md-wide-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--md-gap-item);
}
</style>
