---
theme: default
title: テスト自動化の導入
titleTemplate: '%s'
info: md-to-slidev の完成例。数値は説明用の架空の値。
canvasWidth: 1920
aspectRatio: 16/9
colorSchema: light
fonts:
  sans: Noto Sans JP
  weights: 400,500,700
themeConfig:
  primary: '#4F6D7A'
lineNumbers: false
drawings:
  persist: false
mdc: false
htmlAttrs:
  lang: ja
layout: md-cover
subtitle: 回帰テストを段階的に自動化する
author: 開発部
---

<!--
- 名乗りは短く。すぐに目次へ進む
- 想定時間: 20秒
-->

---
layout: md-toc
---

<!--
- 現状 → 進め方 → 運用 の順で話すと伝える
- 想定時間: 20秒
-->

---
layout: md-section
title: 現状
---

<!--
- 想定時間: 10秒
-->

---
layout: md-standard
title: 回帰テストは手作業で、リリース前に2人で3日かかっている
conclusion: 約400項目を、月2回、2人で3日かけて手作業で繰り返している
---

- 画面テストの項目 約400
- リリース 月2回
- リリース前に 2人 × 3日

::figure::

<Step dir="v" :items="[{ label: 'リリース前', sub: '月2回' }, { label: '手作業の回帰テスト', sub: '約400項目' }, { label: '2人 × 3日' }]" :highlight="[2]" />

<!--
- 400項目は画面テストの数。API テストは含めていない
- 想定時間: 60秒
-->

---
layout: md-standard
title: 手作業のテストは同じ項目の繰り返しで、見落としも起きている
conclusion: リリース後の不具合4件のうち3件は、テスト項目にあった見落とし
---

- 直近3か月のリリース後不具合 4件
- うち3件 既存のテスト項目に含まれていた
- 残り1件 テスト項目になかったケース

::figure::

<Branch from="リリース後の不具合 4件" :to="[{ label: 'テスト項目にあった', tag: '3件' }, { label: 'テスト項目になかった', tag: '1件' }]" :highlight="[0]" />

<!--
- 3件は「項目はあったが手作業で見落とした」もの。項目の不足ではなく、繰り返しの疲れが原因
- 残り1件は自動化しても防げない。項目の追加で対応する
- 想定時間: 60秒
-->

---
layout: md-section
title: 進め方
---

<!--
- 想定時間: 10秒
-->

---
layout: md-standard
title: 自動化は一度に全部やらず、3段階で広げる
conclusion: 第1段階の約50項目から始めて、約400項目まで広げる
---

- 第1段階 ログインと主要な画面遷移
- 第2段階 入力フォームの検証
- 第3段階 残りの画面

::figure::

<Step :items="[{ label: '第1段階', sub: '約50項目' }, { label: '第2段階', sub: '約150項目' }, { label: '第3段階', sub: '約200項目' }]" :highlight="[0]" />

<!--
- 第1段階は項目が少なく、失敗したときに戻しやすい範囲
- 段階ごとに結果を見て、次に進むかを決める
- 想定時間: 60秒
-->

---
layout: md-standard
title: 自動化の対象は「繰り返し回数が多く、仕様が安定している項目」から選ぶ
conclusion: 繰り返しが多く仕様が安定した項目ほど、効果が大きく書き直しが少ない
---

- 繰り返しが多い → 自動化の効果が大きい
- 仕様が安定 → テストの書き直しが少ない
- 仕様変更が多い画面 → 手作業のまま

::figure::

<Comparison :columns="[{ title: '自動化する', items: ['多い', '安定'] }, { title: '手作業のまま', items: ['少ない', '変更が多い'] }]" :axes="['繰り返し回数', '仕様']" :highlight="[0]" />

<!--
- 「安定」の目安は、直近3か月で仕様変更がなかった画面
- 想定時間: 60秒
-->

---
layout: md-wide
title: ツールは Playwright と Cypress を比べて Playwright にする
conclusion: 対応ブラウザが広く、社内に実績のある Playwright を使う
---

<Comparison :columns="[{ title: 'Playwright', items: ['Chromium・Firefox・WebKit', 'TypeScript・Python など', '隣の部署で使用中'] }, { title: 'Cypress', items: ['Chromium 系・Firefox', 'JavaScript・TypeScript', 'なし'] }]" :axes="['対応ブラウザ', '言語', '社内の実績']" :highlight="[0]" />

<!--
- 機能の優劣ではなく、うちの条件（WebKit の確認が要る、隣の部署に聞ける）で選んだ
- 各ツールの対応状況は変わるので、導入時に最新情報を確認する
- 想定時間: 75秒
-->

---
layout: md-section
title: 運用
---

<!--
- 想定時間: 10秒
-->

---
layout: md-standard
title: テストコードは機能のコードと同じリポジトリに置き、CI で毎回動かす
conclusion: プルリクエストごとに第1段階、夜間に全テストを CI で動かす
figureWidth: 50%
---

- テストコードは機能のコードと同じリポジトリ
- プルリクエストごと → 第1段階のテスト
- 夜間 → 全テスト

::figure::

<Architecture :chain="['リポジトリ（機能 + テスト）', { label: 'CI', children: ['プルリクエストごと: 第1段階', '夜間: 全テスト'] }]" :highlight="['CI']" />

<!--
- テストを別リポジトリにすると、機能の変更とテストの変更がずれる
- プルリクエストで全テストを回すと待ち時間が長くなるので、第1段階だけにする
- 想定時間: 60秒
-->

---
layout: md-standard
title: 失敗したテストの扱いを最初に決めておく
conclusion: 失敗は「不具合・仕様変更・不安定」の3つに分けて対応する
---

- 不具合 → 修正する
- 仕様変更 → テストを更新する
- 不安定 → 隔離して原因を調べる

::figure::

<Branch from="テストの失敗" :to="[{ label: '不具合', tag: '修正' }, { label: '仕様変更', tag: 'テストを更新' }, { label: '不安定', tag: '隔離して調査' }]" />

<!--
- 「不安定」を放置すると、失敗しても誰も見なくなる。隔離の判断を最初に決めておく
- 想定時間: 60秒
-->

---
layout: md-standard
title: 第1段階の完了を来月末とし、リリース前の手作業を3日から2日に減らすことを目標にする
conclusion: 来月末に第1段階を終え、リリース前の手作業を3日から2日へ
---

- 第1段階の完了 来月末
- リリース前の手作業 3日 → 2日

::figure::

<Step :items="[{ label: '現在', sub: '手作業 3日' }, { label: '来月末', sub: '手作業 2日' }]" :highlight="[1]" />

<!--
- 目標は「2日」。1日の短縮でも、第1段階の約50項目の自動化で見込める範囲
- 次回の月例会で第1段階の結果を報告する
- 想定時間: 60秒
-->
