<script setup>
// スクリーンショット等の画像1枚を見せる図解。src: public 配下のパス（例 "/xxx/foo.png"）。
// label: 画像上部に乗る短いキャプション（省略可）。画像は縦横比を保ったまま枠いっぱいに収まる。
// widthRatio: 横並びにしたときの幅の比率（既定 1）。例えば2枚を1:2にするには片方を1、もう片方を2にする。
// todo: src が無いときに枠の中へ出す「入れる画像の説明」。画像が用意できるまでの置き場所として使う。
const props = defineProps({
  src: { type: String, default: '' },
  label: { type: String, default: '' },
  widthRatio: { type: [Number, String], default: 1 },
  todo: { type: String, default: '' },
})
</script>

<template>
  <figure class="md-shot" :style="{ flex: `${props.widthRatio} 1 0` }">
    <figcaption v-if="label" class="md-shot-label">{{ label }}</figcaption>
    <div class="md-shot-frame" :class="{ 'is-todo': !src }">
      <img v-if="src" :src="src" :alt="label" />
      <span v-else class="md-shot-todo">画像: {{ todo || label }}</span>
    </div>
  </figure>
</template>

<style scoped>
.md-shot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  min-height: 0;
}
.md-shot-label {
  font-family: var(--md-font-label);
  font-size: var(--md-size-label);
  letter-spacing: 0.08em;
  color: var(--md-muted);
  text-align: center;
}
.md-shot-frame {
  flex: 1 1 auto;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: hidden;
}
.md-shot-frame img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block;
}
.md-shot-frame.is-todo {
  min-height: 240px;
  align-items: center;
  border: var(--md-stroke) dashed var(--md-line);
  background: var(--md-accent-3-tint);
  padding: var(--md-box-pad);
}
.md-shot-todo {
  font-size: var(--md-size-note);
  color: var(--md-muted);
  text-align: center;
}
</style>
