<script setup>
// 縦方向の余白だけを入れる空要素。フレックス列（md-text・md-wide-body など）の要素間に、
// 通常の gap より広い隙間を1か所だけ作りたいときに使う。height: CSS の高さ（既定は本文1行分）。
defineProps({
  height: { type: String, default: '' },
})
</script>

<template>
  <div class="md-spacer" :style="{ height: height || 'calc(1em * var(--md-line-height))' }"></div>
</template>

<style scoped>
.md-spacer { flex: 0 0 auto; }
</style>
