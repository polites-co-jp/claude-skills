<script setup>
// 通常の情報ボックス。白背景・細い境界線・角丸・シャドウなし。
// title: 上部の見出し（任意）。accent: '1' | '2' | '3' で境界線をアクセントカラーにする（グループ分け用）。
// width: CSS の幅（任意）。
defineProps({
  title: { type: String, default: '' },
  accent: { type: String, default: '' },
  width: { type: String, default: '' },
})
</script>

<template>
  <div class="md-box" :class="accent && `accent-${accent}`" :style="width ? { width } : {}">
    <div v-if="title" class="md-box-title">{{ title }}</div>
    <div class="md-box-body"><slot /></div>
  </div>
</template>

<style scoped>
.md-box {
  background: var(--md-bg);
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  padding: var(--md-box-pad);
  font-size: var(--md-size-body);
  line-height: var(--md-line-height);
  box-sizing: border-box;
}
.md-box.accent-1 { border-color: var(--md-accent-1); }
.md-box.accent-2 { border-color: var(--md-accent-2); }
.md-box.accent-3 { border-color: var(--md-accent-3); }
.md-box-title { font-weight: 700; }
.md-box-title + .md-box-body { margin-top: 4px; }
.md-box-body :deep(ul) { list-style: none; padding: 0; margin: 0; }
.md-box-body :deep(li) { font-size: var(--md-size-note); }
</style>
