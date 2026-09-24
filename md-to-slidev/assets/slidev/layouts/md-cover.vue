<script setup>
// 表紙: 中央にタイトル。frontmatter: title, subtitle(任意), author(任意), date(任意)
import { computed, unref } from 'vue'
import { useSlideContext } from '@slidev/client'

const ctx = useSlideContext()
const fm = computed(() => unref(ctx.$frontmatter) || {})
const meta = computed(() => [fm.value.author, fm.value.date].filter(Boolean).join('　'))
</script>

<template>
  <div class="slidev-layout md-cover">
    <h1 class="md-cover-title">{{ fm.title }}</h1>
    <p v-if="fm.subtitle" class="md-cover-subtitle">{{ fm.subtitle }}</p>
    <p v-if="meta" class="md-cover-meta">{{ meta }}</p>
    <slot />
  </div>
</template>
