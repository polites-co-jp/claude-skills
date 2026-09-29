---
theme: default
title: テスト自動化の導入
titleTemplate: '%s'
info: 回帰テストの自動化を段階的に始める提案。開発部の月例会、15分
canvasWidth: 1920
aspectRatio: 16/9
colorSchema: light
fonts:
  sans: Noto Sans JP
  weights: 400,500,700
themeConfig:
  primary: '#5980A6'
lineNumbers: false
drawings:
  persist: false
mdc: false
htmlAttrs:
  lang: ja
layout: md-cover
---

---
layout: md-section
title: 現状
---

---
layout: md-shots
title: 回帰テストの現状
conclusion: |-
  約400項目を
  月2回、2人で3日かけて
  手作業で繰り返す
---

- 画面テストの項目
  - 約400
- 回帰テスト
  - 手作業
  - リリース前に2人で3日
- リリース
  - 月2回

::figure::

<Step :items="['開発', { label: '回帰テスト', sub: '手作業・2人で3日' }, 'リリース']" :highlight="[1]" :loop="{ from: 2, to: 0, label: '月2回' }" />

<!--
- 次のスライドで、この手作業から見落としが出ていることを示す
-->

---
layout: md-standard
title: 手作業テストの見落とし
conclusion: |-
  リリース後の不具合
  4件のうち3件は
  テスト項目にあった
  見落とし
---

- 手作業のテスト
  - 同じ項目の繰り返し
  - 見落としが起きている
- 直近3か月のリリース後の不具合
  - 4件

::figure::

<Branch from="リリース後の不具合 4件" :to="[{ label: '既存のテスト項目にあった', tag: '3件' }, { label: 'テスト項目になかった', tag: '1件' }]" :highlight="[0]" />

<!--
- 残り1件はテスト項目の追加で扱う話で、自動化では防げない
-->

---
layout: md-section
title: 進め方
---

---
layout: md-shots
title: 自動化の3段階
conclusion: |-
  約50項目から始め
  約400項目まで広げる
---

- 一度に全部は自動化しない
- 3段階で対象を広げる

::figure::

<Step :items="[{ label: '第1段階', sub: 'ログイン・主要な画面遷移 約50項目' }, { label: '第2段階', sub: '入力フォームの検証 約150項目' }, { label: '第3段階', sub: '残りの画面 約200項目' }]" :highlight="[0]" />

::note::

<EmphasisBox>約50 ＋ 約150 ＋ 約200 ＝ 画面テスト 約400項目</EmphasisBox>

---
layout: md-stack
title: 自動化の対象の選び方
conclusion: |-
  繰り返しが多く
  仕様が安定した項目
  から自動化する
---

- 繰り返し回数が多い項目
  - 自動化の効果が大きい
- 仕様が安定している項目
  - テストの書き直しが少ない

::figure::

<Group title="自動化する" dir="v">
  <Box>繰り返し回数が多い項目</Box>
  <Box>仕様が安定している項目</Box>
</Group>

<Group title="手作業のまま残す" dir="v">
  <Box>仕様変更が多い画面</Box>
</Group>

---
layout: md-wide
title: テストツールの比較
conclusion: |-
  対応ブラウザが広く
  社内に実績のある
  Playwright を使う
---

<Comparison :columns="[{ title: 'Playwright', items: ['Chromium・Firefox・WebKit', 'TypeScript・Python など', '隣の部署で使用中'] }, { title: 'Cypress', items: ['Chromium 系・Firefox', 'JavaScript・TypeScript', 'なし'] }]" :axes="['対応ブラウザ', '言語', '社内の実績']" />

<!--
- 要確認: 対応ブラウザと言語は、発表前に両ツールの公式情報で確かめる
-->

---
layout: md-section
title: 運用
---

---
layout: md-standard
title: テストの置き場所と実行
conclusion: |-
  同じリポジトリに置き
  PRごとと夜間に
  CI で動かす
---

- テストコードの置き場所
  - 機能のコードと同じリポジトリ
- CI で毎回動かす

::figure::

<Branch from="CI" :to="[{ label: 'プルリクエストごと', tag: '第1段階' }, { label: '夜間', tag: '全テスト' }]" />

---
layout: md-standard
title: 失敗したテストの扱い
conclusion: |-
  失敗は
  不具合・仕様変更・不安定
  の3つに分けて対応
---

- 扱いは最初に決めておく
  - 失敗したテストの原因は3つ
- 原因ごとに対応を分ける

::figure::

<Branch from="テストの失敗" :to="[{ label: '不具合', tag: '修正する' }, { label: '仕様変更', tag: 'テストを更新する' }, { label: '不安定', tag: '隔離して原因を調べる' }]" />

---
layout: md-standard
title: 第1段階の目標
conclusion: |-
  来月末に第1段階を終え
  手作業を3日から2日へ
---

- 第1段階の完了
  - 来月末
- リリース前の手作業
  - 3日 → 2日

::figure::

<Step :items="[{ label: '現在', sub: '手作業 3日' }, { label: '来月末', sub: '第1段階を完了・手作業 2日' }]" :highlight="[1]" />
