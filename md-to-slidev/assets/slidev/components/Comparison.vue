<script setup>
// 2つ以上の対象の比較。columns: [{ title, items: [...] }]。axes: 行の見出し（比較の軸。任意）。
// highlight: 強調する列の番号。勝敗を示す色分けはしない。強調は「話題にしている列」を示すためだけに使う。
import { computed } from 'vue'

const props = defineProps({
  columns: { type: Array, required: true },
  axes: { type: Array, default: () => [] },
  highlight: { type: Array, default: () => [] },
  accent: { type: String, default: '1' },
})
const rows = computed(() => Math.max(props.axes.length, ...props.columns.map((c) => (c.items || []).length)))
</script>

<template>
  <table class="md-compare" :class="`accent-${accent}`">
    <thead>
      <tr>
        <th v-if="axes.length" class="md-compare-axis"></th>
        <th v-for="(c, i) in columns" :key="i" :class="{ 'is-hl': highlight.includes(i) }">{{ c.title }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r">
        <th v-if="axes.length" class="md-compare-axis">{{ axes[r - 1] || '' }}</th>
        <td v-for="(c, i) in columns" :key="i" :class="{ 'is-hl': highlight.includes(i) }">{{ (c.items || [])[r - 1] || '' }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.md-compare {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--md-size-body);
  line-height: 1.4;
}
.md-compare th,
.md-compare td {
  border: var(--md-stroke) solid var(--md-line);
  padding: 8px 14px;
  text-align: left;
  vertical-align: top;
}
.md-compare thead th { font-weight: 700; text-align: center; }
.md-compare-axis { font-weight: 500; white-space: nowrap; font-size: var(--md-size-note); }
.md-compare .is-hl { border-left-width: var(--md-stroke-strong); border-right-width: var(--md-stroke-strong); }
.md-compare.accent-1 .is-hl { border-left-color: var(--md-accent-1); border-right-color: var(--md-accent-1); }
.md-compare.accent-2 .is-hl { border-left-color: var(--md-accent-2); border-right-color: var(--md-accent-2); }
.md-compare.accent-3 .is-hl { border-left-color: var(--md-accent-3); border-right-color: var(--md-accent-3); }
.md-compare thead .is-hl { border-top-width: var(--md-stroke-strong); }
.md-compare.accent-1 thead .is-hl { border-top-color: var(--md-accent-1); }
.md-compare.accent-2 thead .is-hl { border-top-color: var(--md-accent-2); }
.md-compare.accent-3 thead .is-hl { border-top-color: var(--md-accent-3); }
.md-compare tbody tr:last-child .is-hl { border-bottom-width: var(--md-stroke-strong); }
.md-compare.accent-1 tbody tr:last-child .is-hl { border-bottom-color: var(--md-accent-1); }
.md-compare.accent-2 tbody tr:last-child .is-hl { border-bottom-color: var(--md-accent-2); }
.md-compare.accent-3 tbody tr:last-child .is-hl { border-bottom-color: var(--md-accent-3); }
</style>
