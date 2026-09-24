<script setup>
// 目次: md-section スライドの title を順に並べる。default slot に内容があればそちらを優先する。
// frontmatter: title(任意, 既定「目次」)
import { computed, unref, useSlots } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import MdFooter from '../components/MdFooter.vue'

const ctx = useSlideContext()
const nav = useNav()
const slots = useSlots()
const fm = computed(() => unref(ctx.$frontmatter) || {})
const sections = computed(() =>
  (unref(nav.slides) || [])
    .map((s) => s?.meta?.slide?.frontmatter || {})
    .filter((f) => f.layout === 'md-section')
    .map((f) => f.title || ''),
)
</script>

<template>
  <div class="slidev-layout md-toc">
    <h1 class="md-title">{{ fm.title || '目次' }}</h1>
    <div class="md-body">
      <div class="md-text">
        <slot v-if="slots.default" />
        <ol v-else class="md-toc-list">
          <li v-for="(s, i) in sections" :key="i">
            <span class="md-toc-num">{{ String(i + 1).padStart(2, '0') }}</span>
            <span>{{ s }}</span>
          </li>
        </ol>
      </div>
    </div>
    <MdFooter />
  </div>
</template>
