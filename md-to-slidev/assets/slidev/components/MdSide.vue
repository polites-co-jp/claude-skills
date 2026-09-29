<script setup>
// 本文スライド右側の仕様欄: SECTION（直前の md-section の title）／CONCLUSION（frontmatter の conclusion）／ページ数。
// 章番号は自動採番（composables/chapters.ts、layouts/md-section.vue と同じロジックを共有）。
// section は frontmatter の section で上書きできる（その場合は章番号を付けずそのまま表示する）。
import { computed, unref } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import { useChapters } from '../composables/chapters'

const props = defineProps({ conclusion: { type: String, default: '' } })
const ctx = useSlideContext()
const nav = useNav()
const page = computed(() => unref(ctx.$page) || 0)
const fm = computed(() => unref(ctx.$frontmatter) || {})
const slides = computed(() => unref(nav.slides) || [])
const total = computed(() => unref(nav.total) || slides.value.length)
const { allSections, numberOf } = useChapters()

const currentSection = computed(() => {
  if (fm.value.section) return { num: '', name: fm.value.section }
  const preceding = allSections.value.filter((s) => s.slideIndex <= page.value - 1)
  const found = preceding[preceding.length - 1]
  if (!found) return { num: '', name: '' }
  return { num: numberOf(found.slideIndex), name: found.fm.title || '' }
})
const pad = (n) => String(n).padStart(2, '0')
</script>

<template>
  <aside class="md-side">
    <div class="md-side-cell md-side-section">
      <span class="md-side-label">SECTION</span>
      <span class="md-side-section-name">
        <span v-if="currentSection.num" class="md-side-section-num">{{ currentSection.num }}</span>
        <span class="md-side-section-title">{{ currentSection.name }}</span>
      </span>
    </div>
    <div class="md-side-cell md-side-conclusion">
      <template v-if="props.conclusion">
        <span class="md-side-label">CONCLUSION</span>
        <p class="md-side-conclusion-text">{{ props.conclusion }}</p>
      </template>
    </div>
    <div class="md-side-foot">
      <span class="md-side-page">{{ pad(page) }}<span class="md-side-total"> / {{ pad(total) }}</span></span>
    </div>
  </aside>
</template>
