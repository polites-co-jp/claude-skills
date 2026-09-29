<script setup>
// セクション区切り（1a）: CHAPTER 番号 / 総章数、角括弧の枠に大きな番号と章題、下に資料名。
// 番号は自動採番（composables/chapters.ts）。自分より前にある「番号付き md-section」の数 + 1 になる。
// 番号を振りたくない区切り（オープニング・まとめ・付録など）は frontmatter に numbered: false を付ける。
// frontmatter: title, subtitle(任意), numbered(任意, 既定 true)
import { computed, unref } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import { useChapters } from '../composables/chapters'

const ctx = useSlideContext()
const nav = useNav()
const fm = computed(() => unref(ctx.$frontmatter) || {})
const page = computed(() => unref(ctx.$page) || 0)
const slides = computed(() => unref(nav.slides) || [])
const { chapterTotal, numberOf } = useChapters()
const num = computed(() => numberOf(page.value - 1))
const deckTitle = computed(() => slides.value[0]?.meta?.slide?.frontmatter?.title || '')
</script>

<template>
  <div class="slidev-layout md-section">
    <div class="md-section-main">
      <div class="md-section-kicker">
        <span>{{ num ? 'CHAPTER' : 'SECTION' }}</span>
        <span v-if="num" class="md-section-kicker-count">{{ num }} / {{ chapterTotal }}</span>
      </div>
      <div class="md-section-frame">
        <i class="md-corner tl"></i>
        <i class="md-corner br"></i>
        <span v-if="num" class="md-section-num">{{ num }}</span>
        <h1 class="md-section-title">{{ fm.title }}</h1>
      </div>
      <p v-if="fm.subtitle" class="md-section-subtitle">{{ fm.subtitle }}</p>
      <slot />
    </div>
    <footer class="md-rule-footer">
      <span>{{ deckTitle }}</span>
    </footer>
  </div>
</template>
