
---
layout: md-toc
---

---
layout: md-section
title: 部品の見本
numbered: false
---

---
layout: md-shots
title: Sequence と Shot
conclusion: |-
  会話は Sequence
  画像は Shot
---

- 画像が無いときは todo の枠が出る

::figure::

<Sequence left="ユーザー" right="生成AI" :messages="[{ from: 'left', text: '「おはよう」' }, { from: 'right', text: '「おはようございます」' }]" :groups="[{ label: '1回目', count: 2 }]" :highlight="[0]" />
<Shot label="プロンプト" todo="チャット欄に仕様を入力した画面" />

::note::

<EmphasisBox>見本のスライド。ビルドの確認用</EmphasisBox>

---
layout: md-stack
title: Caption・Hub・Layer
conclusion: 並べて比べる
---

- 図を横に並べる

::figure::

<Caption text="例">
  <Hub center="中心" :items="['A', 'B', 'C']" />
</Caption>

<Layer :layers="['上', { label: '中', sub: '補足' }, '下']" :highlight="[1]" />

---
layout: md-wide
title: TrendChart・Architecture
conclusion: 傾向と構成
---

<TrendChart width="460px" y-caption="量" :x-labels="['軽い', '重い']" :series="[{ label: 'A', values: [0.4, 0.9], accent: '1' }, { label: 'B', values: [0.2], accent: '3', stopAt: 0.5, stopValue: 0.25 }]" :bracket="{ x: 0, label: '同じ' }" :points="[{ series: 0, x: 1, icon: 'ok', label: '良い', side: 'top' }]" />

<Spacer />

<Architecture :chain="['利用者', { label: '本体', sub: '説明' }, { label: 'ツール', children: ['X', 'Y'] }]" :tags="{ '本体': ['印'] }" :highlight="['印']" :overlay="{ label: '範囲', items: ['本体', 'ツール'] }" />

---
layout: md-standard
title: Box・Label・Logo・矢印
conclusion: 小さな部品
---

- <Logo name="claude">Claude Code</Logo>、<Logo name="openai">Codex</Logo>
- <Label text="3件" /> <Label text="仮定" accent="3" />

::figure::

<Group title="まとまり" dir="v">
  <Box title="定義">本文</Box>
  <Arrow dir="down" :length="32" label="次" />
  <Connector dir="v" :length="24" />
  <Box>終わり</Box>
</Group>
