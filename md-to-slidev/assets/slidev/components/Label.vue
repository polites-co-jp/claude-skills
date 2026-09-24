<script setup>
// 短い説明・分類・状態を示すラベル。18px。accent で枠と文字をアクセントカラーにする。
defineProps({
  text: { type: String, default: '' },
  accent: { type: String, default: '' },
})
</script>

<template>
  <span class="md-label" :class="accent && `accent-${accent}`"><slot>{{ text }}</slot></span>
</template>

<style scoped>
.md-label {
  display: inline-block;
  font-size: var(--md-size-note);
  line-height: 1.3;
  padding: 2px 10px;
  border: var(--md-stroke) solid var(--md-line);
  border-radius: var(--md-radius);
  white-space: nowrap;
}
.md-label.accent-1 { border-color: var(--md-accent-1); color: var(--md-accent-1); }
.md-label.accent-2 { border-color: var(--md-accent-2); color: var(--md-accent-2); }
.md-label.accent-3 { border-color: var(--md-accent-3); color: var(--md-accent-3); }
</style>
