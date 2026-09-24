<script setup>
// 左下にセクション名、右下にページ番号。
// セクション名は frontmatter の section があればそれを使い、無ければ直前の md-section スライドの title を拾う。
import { computed, unref } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'

const ctx = useSlideContext()
const nav = useNav()

const page = computed(() => unref(ctx.$page) || 0)
const fm = computed(() => unref(ctx.$frontmatter) || {})

const section = computed(() => {
  if (fm.value.section) return fm.value.section
  const slides = unref(nav.slides) || []
  for (let i = page.value - 1; i >= 0; i--) {
    const f = slides[i]?.meta?.slide?.frontmatter || {}
    if (f.layout === 'md-section') return f.title || ''
  }
  return ''
})

const num = computed(() => String(page.value).padStart(2, '0'))
</script>

<template>
  <footer class="md-footer">
    <span class="md-footer-section">{{ section }}</span>
    <span class="md-footer-page">{{ num }}</span>
  </footer>
</template>
