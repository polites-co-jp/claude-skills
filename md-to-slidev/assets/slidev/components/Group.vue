<script setup>
// 複数の要素をまとめる枠。title は枠の左上に乗る。accent で枠と薄い下地をアクセントカラーにする。
// dir: 中身の並び。h（横）| v（縦）。
defineProps({
  title: { type: String, default: '' },
  accent: { type: String, default: '' },
  dir: { type: String, default: 'h' },
})
</script>

<template>
  <div class="md-group" :class="[accent && `accent-${accent}`, `dir-${dir}`]">
    <span v-if="title" class="md-group-title">{{ title }}</span>
    <div class="md-group-body"><slot /></div>
  </div>
</template>

<style scoped>
.md-group {
  position: relative;
  border: var(--md-stroke) dashed var(--md-line);
  border-radius: var(--md-radius);
  padding: 20px 16px 14px;
  margin-top: 12px;
  box-sizing: border-box;
}
.md-group.accent-1 { border-color: var(--md-accent-1); background: var(--md-accent-1-tint); }
.md-group.accent-2 { border-color: var(--md-accent-2); background: var(--md-accent-2-tint); }
.md-group.accent-3 { border-color: var(--md-accent-3); background: var(--md-accent-3-tint); }
.md-group-title {
  position: absolute;
  top: -13px;
  left: 12px;
  padding: 0 6px;
  background: var(--md-bg);
  font-size: var(--md-size-note);
  line-height: 1.3;
}
.md-group-body { display: flex; gap: var(--md-gap-item); align-items: center; }
.md-group.dir-v .md-group-body { flex-direction: column; align-items: stretch; }
</style>
