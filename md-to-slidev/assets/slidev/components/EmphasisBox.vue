<script setup>
// 重要情報のボックス。md-section のタイトル枠と同じ境界線（1px solid var(--md-line)）・やや大きい文字。
// 左上・右下に md-section と同じカギ括弧型の飾り（角の実線）を付ける。
// 1スライドに1つまでを目安にする。accent の既定は '1'。
defineProps({
  title: { type: String, default: '' },
  accent: { type: String, default: '1' },
  width: { type: String, default: '' },
})
</script>

<template>
  <div class="md-emphasis" :class="`accent-${accent}`" :style="width ? { width } : {}">
    <i class="md-emphasis-corner tl"></i>
    <i class="md-emphasis-corner br"></i>
    <div v-if="title" class="md-emphasis-title">{{ title }}</div>
    <div class="md-emphasis-body"><slot /></div>
  </div>
</template>

<style scoped>
.md-emphasis {
  position: relative;
  background: var(--md-bg);
  border: 1px solid var(--md-line);
  border-radius: var(--md-radius);
  padding: 14px 20px;
  font-size: var(--md-size-conclusion);
  font-weight: 500;
  line-height: 1.4;
  color: var(--md-accent-1-deep);
  box-sizing: border-box;
}
.md-emphasis.accent-2 { border-color: var(--md-accent-2); }
.md-emphasis.accent-3 { border-color: var(--md-accent-3); }
.md-emphasis-corner { position: absolute; width: 14px; height: 14px; }
.md-emphasis-corner.tl {
  top: -8px;
  left: -8px;
  border-top: 2px solid var(--md-muted);
  border-left: 2px solid var(--md-muted);
}
.md-emphasis-corner.br {
  bottom: -8px;
  right: -8px;
  border-bottom: 2px solid var(--md-muted);
  border-right: 2px solid var(--md-muted);
}
.md-emphasis-title {
  font-size: var(--md-size-note);
  font-weight: 500;
  margin-bottom: 4px;
}
</style>
