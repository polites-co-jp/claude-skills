// md-section の章番号を自動採番するための共通ロジック。
// layouts/md-section.vue（章区切りページ）と components/MdSide.vue（本文右側の SECTION 欄）の両方から使う。
//
// 数え方: frontmatter が layout: md-section の全スライドを出現順に集め（allSections）、
// そのうち numbered: false が付いていないものだけを章として数える（chapters）。
// オープニング・まとめ・付録のように番号を振りたくない区切りには frontmatter に `numbered: false` を付ける。
import { computed, unref } from 'vue'
import { useNav } from '@slidev/client'

export function useChapters() {
  const nav = useNav()
  const slides = computed(() => unref(nav.slides) || [])

  const allSections = computed(() =>
    slides.value
      .map((s, slideIndex) => ({ slideIndex, fm: s?.meta?.slide?.frontmatter || {} }))
      .filter(({ fm }) => fm.layout === 'md-section'),
  )

  const chapters = computed(() => allSections.value.filter(({ fm }) => fm.numbered !== false))

  const pad = (n: number) => String(n).padStart(2, '0')

  // スライド index（0始まり）を渡すと、それが番号付き章なら "01" 等、そうでなければ '' を返す
  const numberOf = (slideIndex: number) => {
    const i = chapters.value.findIndex((c) => c.slideIndex === slideIndex)
    return i >= 0 ? pad(i + 1) : ''
  }

  const chapterTotal = computed(() => pad(chapters.value.length))

  return { allSections, chapters, chapterTotal, numberOf }
}
