<script setup>
// セクション区切り: 白背景、中央に大きなセクションタイトル。frontmatter: title, subtitle(任意)
import { computed, unref } from 'vue'
import { useSlideContext } from '@slidev/client'

const ctx = useSlideContext()
const fm = computed(() => unref(ctx.$frontmatter) || {})
</script>

<template>
  <div class="slidev-layout md-section">
    <h1 class="md-section-title">{{ fm.title }}</h1>
    <p v-if="fm.subtitle" class="md-section-subtitle">{{ fm.subtitle }}</p>
    <slot />
  </div>
</template>
