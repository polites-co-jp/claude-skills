# 部品カタログと slides.md の書き方

同梱の部品（`assets/slidev/layouts/`・`components/`）の使い方と、`slides.md` の書式。

## 図の選び方

内容の型から部品を選ぶ。型が無ければ図なし。図は本文に無い構造（順序・分かれ方・並べた比較・戻り・範囲）を足すもので、本文の箇条をそのまま箱に並べ直さない。

| 内容の型 | 例 | 部品と置き方 |
|---|---|---|
| プロセス・手順・時系列・変化 | 要件定義 → 設計 → 実装 | `Step`。工程ごとの担い手は `sub` に（`{ label: 'コーディング', sub: '生成AI' }`） |
| 戻りのある流れ・ループ | 考える → ツールを使う → 結果を見る → 考える | `Step` に `loop`。同じ語を末尾に繰り返して環を表さない |
| 2つのやり方・状態の対比 | 検索と生成AI、Lv2 と Lv3 | `md-stack` の `::figure::` に `Group` を2つ並べ、中に同じ形の `Step dir="v"` を置く。違う箇所だけ `highlight` |
| 会話・要求と応答のやりとり | ユーザーと生成AIの往復 | `Sequence`。テキストのコードブロックで会話を書かない |
| 分岐・場合分け・内訳 | 失敗 → 不具合／仕様変更／不安定 | `Branch`。`tag` は分岐先ごとに違う情報（件数・対応）。全部同じ語なら Branch にしない |
| 2つ以上の対象を軸で比べる | A と B を軸ごとに | `Comparison`。`axes` を必ず付ける。列見出しは具体名（「大きく賢い／中間」ではなく「Opus／Sonnet」） |
| 用語と役割の一覧 | Skills／Agents／MCP の役割 | `Comparison` の1列（`columns` 1つ＋`axes` に用語） |
| 階層・レイヤー | 上位 → 中位 → 下位 | `Layer` |
| システム構成・役割の連なり | 利用者 → サービス → 基盤 → ツール群 | `Architecture`。後から足す仕組みは `tags`、範囲は `overlay` |
| 中心と周辺 | ハーネスと、それを構成する仕組み | `Hub` |
| 要素のまとまり・棚 | 「Skills棚」に並ぶ Skill | `Group` に `Box` を並べる |
| 例として示す図 | 「Agent分割例」 | 部品を `Caption` で包み、見出しを付ける |
| 画面・生成物・公式の図 | プロンプト画面、生成されたコード | `Shot`（`md-shots` の `::figure::`）。画像が無ければ `todo` で置き場所だけ作る |
| 傾向の説明（実測値でない） | 重い作業ほど差が出る | `TrendChart`。実測値に見せない |
| 覚えて帰る式・注意・原則1つ | トークン数＝消費量＝コスト | `::note::` に `EmphasisBox` |
| 分類・状態の短い印 | 「新規」「3件」 | `Label` |
| 図形をつなぐ | 部品の間 | `Arrow`、`Connector` |

同じ概念が複数のスライドに出るときは、同じ部品・同じ並び・同じラベルで描き、`highlight`（今の話題）や `overlay`（範囲の重ね合わせ）だけを変える。

### 確定版での図の直し方（実例）

| 生成版 | 確定版 |
|---|---|
| 会話の往復をテキストのコードブロックで書いた | `Sequence` で矢印の往復にし、送る量が増える行を `highlight` |
| `Branch from="箱に文字を入れて送る"` → 検索／生成AI | `md-stack` に `Group title="検索"` と `Group title="生成AI"`、それぞれ縦の `Step`（入力 → 処理 → 返るもの） |
| 探す → 作る → 行動する の `Step` で3段目を強調 | 「Lv2まで」「Lv3」の `Group` を並べ、誰が実行・確認するかを `Step` で対比 |
| `Step :items="['考える', 'ツールを使う', '結果を見る', '次を考える']"` | `Step :items="['指示を受ける', '考える', 'ツールを使う', '結果を見る']" :loop="{ from: 3, to: 1 }"` |
| `Branch` の tag が全部「見直す」「できない」 | `Step dir="v"` に並べる、または図を外して本文に |
| 軸の無い `Comparison`（向く／向かない、バイブ／仕様書駆動） | `axes` を足す（期間・人数・その後・対象・求める品質） |
| 「1トークンの目安」の `Box` | 本文の2段目に入れ、式を `::note::` の `EmphasisBox` に |
| 冒頭の持ち帰り3つを並べた `Step` | 図を外し、本文の箇条だけにする（本文の並べ直しだったため） |

## レイアウト

すべて右に結論欄（SECTION／CONCLUSION／ページ数）を持つ（表紙・区切りを除く）。スロットは `::figure::`・`::note::` で区切る。

| layout | 使う場面 | 構造 | スロット |
|---|---|---|---|
| `md-standard` | 本文の横に図 | 左: 本文、右: 図（既定 45%）、下: note | 本文／`::figure::`／`::note::` |
| `md-shots` | 本文の下に横長の図・画像。図なしで本文だけも可 | 上: 本文、下: 図が残りの高さいっぱい（直下の要素は横並び）、下: note | 本文（任意）／`::figure::`／`::note::` |
| `md-stack` | 本文の下に図を2〜3個並べて比べる | 上: 本文、下: 図（直下の要素を等幅で横並び） | 本文／`::figure::` |
| `md-wide` | 大きな比較表・コード・全幅の図 | 全幅の本文（部品と箇条を上から順に） | 本文のみ |
| `md-cover` | 表紙 | 左寄せのタイトル・サブタイトル・発表者 | なし |
| `md-section` | セクション区切り | CHAPTER 番号／総章数、枠の中に番号と章題 | なし |
| `md-toc` | 目次（入力に目次・流れがあるときだけ） | `md-section` のタイトルを自動で並べる | 本文（任意） |

- `md-standard` の図の幅は `figureWidth` で `"33%"`〜`"55%"`。図が無ければ本文が全幅になる
- `md-wide` には `::figure::` が無い。表の上に前置き（「※厳密なランキングではなく、特徴を理解するための例」）、表の下に箇条を置く
- 章番号は `md-section` の出現順に自動で振られる。オープニング・まとめ・付録など番号を振らない区切りは `numbered: false`

## 部品

すべて Vue コンポーネント。`slides.md` の中に HTML タグとして書く。配列やオブジェクトを渡す属性は `:items="[...]"` のように `:` を付ける。

### Step

```html
<Step :items="['要件定義', '設計', '実装', 'テスト']" />
<Step dir="v" :items="[{ label: '要件定義', sub: '人間' }, { label: '仕様・設計', sub: '人間+生成AI' }]" :highlight="[1]" />
<Step :items="['指示を受ける', '考える', 'ツールを使う', '結果を見る']" :loop="{ from: 3, to: 1 }" />
```

| 属性 | 意味 |
|---|---|
| `items` | 文字列か `{ label, sub }` の配列 |
| `dir` | `h`（横、既定）／`v`（縦） |
| `highlight` | 強調する要素の番号（0始まり）の配列 |
| `accent` | 強調の色 `1`／`2`／`3`（既定 `1`） |
| `loop` | 手前の工程へ戻る矢印 `{ from, to, label }`（0始まり）。横向きで使う |

### Branch

```html
<Branch from="テストの失敗" :to="[{ label: '不具合', tag: '修正' }, { label: '仕様変更', tag: 'テストを更新' }, { label: '不安定', tag: '隔離して調査' }]" />
```

| 属性 | 意味 |
|---|---|
| `from` | 起点の文字列 |
| `to` | 文字列か `{ label, sub, tag }` の配列。`tag` は右端の短い印（件数・条件・対応） |
| `highlight` | 強調する分岐先の番号の配列 |
| `row` | 分岐先1行の高さ px（既定 64。`sub` を付けて2行になるなら 80〜96） |

### Comparison

```html
<Comparison
  :columns="[{ title: 'A', items: ['広い', 'あり'] }, { title: 'B', items: ['狭い', 'なし'] }]"
  :axes="['対応範囲', '社内の実績']"
  :highlight="[0]" />
```

| 属性 | 意味 |
|---|---|
| `columns` | `{ title, items }` の配列。`items` は軸ごとの値。値が無い軸は `''` |
| `axes` | 行の見出し（比較の軸）。付ける |
| `highlight` | 今話している列の番号の配列。勝敗の意味で使わない |

軸が4つを超える、列が3つを超えるときは `md-wide` に置く。

### Sequence

```html
<Sequence
  left="ユーザー"
  right="生成AI"
  :messages="[
    { from: 'left', text: '「おはよう」' },
    { from: 'right', text: '「おはようございます」' },
    { from: 'left', text: '「おはよう」「おはようございます」「今日はいい天気だね」' },
  ]"
  :highlight="[2]" />
```

| 属性 | 意味 |
|---|---|
| `left`／`right` | 参加者名 |
| `messages` | `{ from: 'left' \| 'right', text }` の配列（上から時系列） |
| `groups` | 「ここまでが n 回目」を示す角括弧 `{ label, count }`（先頭から何件目まで） |
| `highlight` | 強調する `groups` の番号の配列 |

### Group

```html
<Group title="検索">
  <Step dir="v" :items="[{ label: 'キーワード' }, { label: '索引を引く', sub: '既存ページ' }]" />
</Group>
<Group title="Skills棚" dir="v">
  <Box>仕様書作成スキル</Box>
  <Box>テストコード作成スキル</Box>
</Group>
```

`title` は枠の左上。`dir="v"` で中身を縦に並べる。`accent` で枠と薄い下地に色。対比では `md-stack` の `::figure::` に2つ並べる。

### Caption

```html
<Caption text="Agent分割例">
  <Step dir="v" :items="['要求', '仕様書生成エージェント', '開発エージェント']" />
</Caption>
```

図の上に短い見出しを付ける。図が「例」や「一部」であることを示すときに使う。

### Shot

```html
<Shot src="/prompt.png" label="プロンプト" :width-ratio="1" />
<Shot src="/code.png" label="生成されたコード" :width-ratio="2" />
<Shot label="プロンプト" todo="チャット欄に実装仕様を入力した画面" />
```

| 属性 | 意味 |
|---|---|
| `src` | `public/` 配下のパス。無ければ `todo` を点線の枠に出す |
| `label` | 画像の上の短い見出し |
| `widthRatio` | 横並びのときの幅の比 |
| `todo` | 画像が無いときの「入れる画像の説明」。報告の画像一覧にも載せる |

`md-shots` の `::figure::` に置くと、残りの高さいっぱいに表示される。

### EmphasisBox

```html
::note::

<EmphasisBox>トークン数＝コンテキストの消費量＝利用量・コスト</EmphasisBox>
```

角に飾りの付いた枠で、1行の強調を示す。`::note::` に1スライド1つまで。結論の言い換えは置かない。`title` を付けると枠の上に見出しが出る。

### Architecture

```html
<Architecture
  :chain="['ユーザー', '要求・仕様', 'コンテキストウィンドウ', { label: 'LLM', sub: '次の行動を決める' }, { label: 'ツール', children: ['ファイル', 'ターミナル', '外部サービス'] }]"
  :tags="{ 'コンテキストウィンドウ': ['Rules', 'Skills'], 'ツール': ['MCP'] }"
  :highlight="['Rules', 'Skills', 'MCP']"
  :overlay="{ label: '自分で設計・設定する', items: ['Rules', 'Skills', 'MCP'] }" />
```

| 属性 | 意味 |
|---|---|
| `chain` | 上から下へつながる要素。文字列か `{ label, sub, children }`。`children` は右に並ぶ |
| `tags` | `{ ノードのラベル: [短い語] }`。ノードの左脇に付く印。後から足す仕組みを示す |
| `highlight` | 強調する要素のラベルの配列（子要素・tags の語も可） |
| `overlay` | `{ label, items }`。`items` の要素に薄い下地を敷き、上に `label` を示す |

話が進むにつれて同じ `chain` のまま `tags`・`highlight`・`overlay` を変える。`chain` を毎回組み直さない。

### Layer

```html
<Layer :layers="[{ label: '成果物', sub: '目的の達成' }, { label: 'ワークフロー' }, { label: '基盤' }]" :highlight="[1]" />
```

`layers` は上から順。文字列か `{ label, sub, accent }`。`highlight` は強調する層の番号の配列。

### Hub

```html
<Hub center="ハーネス" :items="['Rules', 'Skills', 'Agents', 'MCP', 'Hooks']" />
```

中心の概念と周りの要素を放射状に置く。`items` は文字列か `{ label, sub }`。

### TrendChart

```html
<TrendChart
  width="460px"
  y-caption="消費トークン"
  :x-labels="['軽い作業', '重い作業']"
  :series="[{ label: 'Opus', values: [0.45, 0.9], accent: '1' }, { label: 'Haiku', values: [0.15], accent: '3', stopAt: 0.5, stopValue: 0.22 }]"
  :bracket="{ x: 0, label: '結果は同じ' }"
  :points="[{ series: 0, x: 1, icon: 'ok', label: '期待通り', side: 'top' }]" />
```

傾向を説明する仮想の折れ線。`values` は 0〜1 の相対値。実測値として示さない（入力に数値がある場合は Comparison か表にする）。

| 属性 | 意味 |
|---|---|
| `xLabels`／`xCaption`／`yCaption` | 横軸の区分と軸の見出し |
| `series` | `{ label, values, accent, dash, stopAt, stopValue }` |
| `bracket` | `{ x, label }`。その位置の値の範囲を縦の目盛りで示す |
| `points` | `{ series, x, icon: 'ok' \| 'ng', label, side }`。点に丸／バツと注記 |
| `width` | 幅（任意） |

### Box・Label・Spacer・Logo

```html
<Box title="定義">Context = モデルに渡される情報の全体</Box>
<Label text="3件" /> <Label text="仮定" accent="3" />
<Spacer />
<Logo name="claude">Claude Code</Logo>
```

- `Box`: 白背景・細い境界線。`title` で見出し。`accent` で境界線に色（グループ分け用）
- `Label`: 短い印。`accent` で枠と文字に色
- `Spacer`: 縦の余白を1か所だけ広げる。`height` で高さ（既定は本文1行）。`style="margin…"` の代わりに使う
- `Logo`: 本文中の製品名の脇に小さなアイコンを付ける。`name` は `claude`／`openai`

### Arrow・Connector

```html
<Arrow dir="right" :length="48" label="指示" />
<Connector dir="v" :length="32" />
```

`dir` は `right`／`down`／`left`／`up`（Connector は `h`／`v`）。`strong` で 2px。Step・Branch・Architecture・Sequence は内部で矢印を持つので、外から足さない。

## slides.md の書き方

### 先頭（headmatter）

先頭の frontmatter がプレゼン全体の設定で、同時に1枚目（表紙）の設定でもある。以下をそのまま使い、`title`・`info`・`subtitle`・`author`・`date` だけ書き換える。

```yaml
---
theme: default
title: プレゼンタイトル
titleTemplate: '%s'
info: 一行の説明
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
subtitle: サブタイトル
author: 発表者
---
```

`htmlAttrs.lang` は入力の言語に合わせる。表紙にノートは付けない。

### セクション区切り

```markdown
---
layout: md-section
title: |-
  検索エンジンと
  生成AIの違い
---
```

オープニング・まとめ・付録は `numbered: false` を足す。タイトルに番号を書かない。

### 本文スライド

`---` で区切り、直後の frontmatter に `layout`・`title`・`conclusion` を書く。本文は Markdown。`::figure::` の後が図、`::note::` の後が下段。末尾の HTML コメントが発表者ノート。

```markdown
---
layout: md-standard
title: Skills
conclusion: |-
  繰り返す作業を
  手順化し、必要なとき
  だけ読み込ませる
---

- Skills
  - 「仕事のやり方・手順・専門知識」を固定する仕組み
- 普段は棚にあり、必要なときだけ読み込まれる
  - コンテキストウィンドウを占有しない
  - ex) 「仕様書を書いて」のときだけ仕様書作成スキルが載る

::figure::

<Group title="Skills棚" dir="v">
  <Box>仕様書作成スキル</Box>
  <Box>テストコード作成スキル</Box>
</Group>

::note::

<EmphasisBox>常に載るのは Rules、必要なときだけ載るのが Skills</EmphasisBox>

<!--
- 前のスライドの「コンテキストウィンドウ」を受けて話す
-->
```

| frontmatter | 意味 |
|---|---|
| `layout` | `md-cover`／`md-section`／`md-standard`／`md-shots`／`md-stack`／`md-wide`／`md-toc` |
| `title` | 話題名。2行にするときは `|-` |
| `conclusion` | 結論。`|-` で1行12字程度に改行 |
| `subtitle` | `md-cover`／`md-section` の副題 |
| `numbered` | `md-section` で `false` にすると章番号を振らない |
| `figureWidth` | `md-standard` の図の幅。`"33%"`〜`"55%"` |
| `section` | 結論欄の SECTION を手で指定するとき |

YAML の値にコロン（`:`）や `#` が入るときは引用符で囲むか `|-` にする。

### 書かないこと

- `<style>` ブロック、`style="…"`、`class="text-sm"` のような文字サイズや色の指定。余白は `<Spacer />`
- 部品の見た目を変える属性（存在しない）。足りない表現は部品側に足す
- Slidev 組み込みの `layout: two-cols` など。レイアウトは同梱の7つだけを使う
- 1スライドに複数の `conclusion`
- 表紙・区切りのノート、想定時間

### 表とコード

入力に Markdown の表があれば、軸が明確なら `Comparison` に、そうでなければ Markdown の表のまま `md-wide` に置く。コードブロックはそのまま書く（18px）。1ブロック 20 行程度までにし、超えるなら要点の行だけにする。仕様書の実物のような文書の例は、`md-standard` の `::figure::` にコードブロックで置いてよい。
