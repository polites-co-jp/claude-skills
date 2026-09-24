<script setup>
// 重要情報のボックス。Box より太い境界線（2px）・アクセントカラー・やや大きい文字。
// 1スライドに1つまでを目安にする。accent の既定は '1'。
defineProps({
  title: { type: String, default: '' },
  accent: { type: String, default: '1' },
  width: { type: String, default: '' },
})
</script>

<template>
  <div class="md-emphasis" :class="`accent-${accent}`" :style="width ? { width } : {}">
    <div v-if="title" class="md-emphasis-title">{{ title }}</div>
    <div class="md-emphasis-body"><slot /></div>
  </div>
</template>

<style scoped>
.md-emphasis {
  background: var(--md-bg);
  border: var(--md-stroke-strong) solid var(--md-accent-1);
  border-radius: var(--md-radius);
  padding: 14px 20px;
  font-size: var(--md-size-conclusion);
  font-weight: 700;
  line-height: 1.4;
  box-sizing: border-box;
}
.md-emphasis.accent-2 { border-color: var(--md-accent-2); }
.md-emphasis.accent-3 { border-color: var(--md-accent-3); }
.md-emphasis-title {
  font-size: var(--md-size-note);
  font-weight: 500;
  margin-bottom: 4px;
}
</style>
