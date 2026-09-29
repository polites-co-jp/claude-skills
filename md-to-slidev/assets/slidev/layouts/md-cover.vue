<script setup>
// 表紙: 左に英字キッカー・タイトル・サブタイトル・発表者。
// frontmatter: title, subtitle(任意), kicker(任意, 英字の小見出し), author(任意), date(任意)
import { computed, unref } from 'vue'
import { useSlideContext } from '@slidev/client'

const ctx = useSlideContext()
const fm = computed(() => unref(ctx.$frontmatter) || {})
</script>

<template>
  <div class="slidev-layout md-cover">
    <div class="md-cover-main">
      <div v-if="fm.kicker" class="md-cover-kicker">{{ fm.kicker }}</div>
      <h1 class="md-cover-title">{{ fm.title }}</h1>
      <p v-if="fm.subtitle" class="md-cover-subtitle">{{ fm.subtitle }}</p>
      <div v-if="fm.author || fm.date" class="md-cover-meta">
        <span v-if="fm.date" class="md-cover-date">{{ fm.date }}</span>
        <span v-if="fm.author">{{ fm.author }}</span>
      </div>
      <slot />
    </div>
  </div>
</template>
