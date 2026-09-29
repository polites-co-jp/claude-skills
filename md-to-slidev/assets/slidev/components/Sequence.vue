<script setup>
// 2者間の会話のキャッチボール（シーケンス図）。left/right は参加者名。
// messages: { from: 'left' | 'right', text } の配列（上から時系列順）。矢印は from の反対側へ向く。
// groups: 「ここまでが n 回目」を示す入れ子の角括弧。{ label, count }（count は先頭から何件目までかを表す、1始まり）。
// highlight: 強調する groups の番号（0始まり）の配列。accent: 強調の色（既定 '1'）。
import { computed } from 'vue'

const props = defineProps({
  left: { type: String, default: '' },
  right: { type: String, default: '' },
  messages: { type: Array, required: true },
  groups: { type: Array, default: () => [] },
  highlight: { type: Array, default: () => [] },
  accent: { type: String, default: '1' },
})

const ROW = 64
const GROUP_STEP = 22
const GROUP_PAD = 10
const LABEL_W = 90

const laneHeight = computed(() => props.messages.length * ROW)
const groupsWidth = computed(() => GROUP_PAD + props.groups.length * GROUP_STEP + LABEL_W)

const bracketX = (gi) => GROUP_PAD + gi * GROUP_STEP
const bracketPath = (gi) => {
  const x = bracketX(gi)
  const y1 = props.groups[gi].count * ROW
  const tick = 8
  return `M${x - tick},0 H${x} V${y1} H${x - tick}`
}
const labelStyle = (gi) => ({
  top: `${(props.groups[gi].count * ROW) / 2}px`,
  left: `${bracketX(gi) + 12}px`,
})
</script>

<template>
  <div class="md-sequence" :class="`accent-${accent}`">
    <div class="md-sequence-heads">
      <div class="md-sequence-head">{{ left }}</div>
      <div class="md-sequence-head is-right">{{ right }}</div>
      <div v-if="groups.length" class="md-sequence-heads-spacer" :style="{ width: `${groupsWidth}px` }" />
    </div>
    <div class="md-sequence-body">
      <div class="md-sequence-lane">
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="md-sequence-row"
          :class="m.from"
          :style="{ height: `${ROW}px` }"
        >
          <div class="md-sequence-text">{{ m.text }}</div>
          <svg class="md-sequence-arrow" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="5" x2="100" y2="5" />
            <polyline :points="m.from === 'left' ? '92,1 100,5 92,9' : '8,1 0,5 8,9'" />
          </svg>
        </div>
      </div>
      <div v-if="groups.length" class="md-sequence-groups" :style="{ width: `${groupsWidth}px` }">
        <svg :width="groupsWidth" :height="laneHeight" :viewBox="`0 0 ${groupsWidth} ${laneHeight}`" aria-hidden="true">
          <path
            v-for="(g, gi) in groups"
            :key="gi"
            :d="bracketPath(gi)"
            :class="{ 'is-hl': highlight.includes(gi) }"
          />
        </svg>
        <div
          v-for="(g, gi) in groups"
          :key="gi"
          class="md-sequence-group-label"
          :class="{ 'is-hl': highlight.includes(gi) }"
          :style="labelStyle(gi)"
        >{{ g.label }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.md-sequence { display: flex; flex-direction: column; }
.md-sequence-heads {
  display: flex;
  padding-bottom: 8px;
  margin-bottom: 6px;
  border-bottom: var(--md-stroke) solid var(--md-line-soft);
  font-size: var(--md-size-body);
  font-weight: 500;
}
.md-sequence-head { flex: 1 1 0; min-width: 0; }
.md-sequence-head.is-right { text-align: right; }
.md-sequence-heads-spacer { flex: 0 0 auto; }
.md-sequence-body { display: flex; align-items: flex-start; }
.md-sequence-lane { flex: 1 1 0; min-width: 0; }
.md-sequence-row { position: relative; box-sizing: border-box; padding: 2px 4px 18px; }
.md-sequence-text {
  font-size: var(--md-size-note);
  line-height: 1.3;
  margin-bottom: 6px;
  white-space: nowrap;
}
.md-sequence-row.right .md-sequence-text { text-align: right; }
.md-sequence-arrow { display: block; width: 100%; height: 12px; }
.md-sequence-arrow line,
.md-sequence-arrow polyline {
  fill: none;
  stroke: var(--md-line-strong);
  stroke-width: var(--md-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
.md-sequence-groups { position: relative; flex: 0 0 auto; }
.md-sequence-groups path {
  fill: none;
  stroke: var(--md-line);
  stroke-width: var(--md-stroke);
}
.md-sequence-groups path.is-hl { stroke-width: var(--md-stroke-strong); }
.md-sequence.accent-1 .md-sequence-groups path.is-hl { stroke: var(--md-accent-1); }
.md-sequence.accent-2 .md-sequence-groups path.is-hl { stroke: var(--md-accent-2); }
.md-sequence.accent-3 .md-sequence-groups path.is-hl { stroke: var(--md-accent-3); }
.md-sequence-group-label {
  position: absolute;
  transform: translateY(-50%);
  font-size: var(--md-size-note);
  color: var(--md-sub);
  white-space: nowrap;
}
.md-sequence-group-label.is-hl { font-weight: 500; }
.md-sequence.accent-1 .md-sequence-group-label.is-hl { color: var(--md-accent-1-deep); }
.md-sequence.accent-2 .md-sequence-group-label.is-hl { color: var(--md-accent-2); }
.md-sequence.accent-3 .md-sequence-group-label.is-hl { color: var(--md-accent-3); }
</style>
