<script setup>
// 図解に短いキャプションを付ける汎用ラッパー。text: 図の上に乗る見出し（Shot の label と同じ見た目）。
// 他の図解部品（Step・Branch・Layer など）をそのまま中に置く。
defineProps({
  text: { type: String, required: true },
})
</script>

<template>
  <figure class="md-caption">
    <figcaption class="md-caption-label">{{ text }}</figcaption>
    <div class="md-caption-body"><slot /></div>
  </figure>
</template>

<style scoped>
.md-caption { margin: 0; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.md-caption-label {
  font-family: var(--md-font-label);
  font-size: var(--md-size-label);
  letter-spacing: 0.08em;
  color: var(--md-muted);
  text-align: center;
}
.md-caption-body { flex: 1 1 auto; min-height: 0; }
</style>
