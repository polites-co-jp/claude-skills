# 部品カタログと slides.md の書き方

同梱の部品（`assets/slidev/components/`）の使い方と、`slides.md` の書式。

## 図解の選び方

内容の型から部品を選ぶ。型が無ければ図なし。

| 内容の型 | 例 | 部品 |
|---|---|---|
| プロセス・手順・時系列・変化 | A → B → C、現在 → 来月末 | `Step` |
| 分岐・場合分け・内訳 | 失敗 → 不具合／仕様変更／不安定 | `Branch` |
| 階層・レイヤー | 上位 → 中位 → 下位 | `Layer` |
| 2つ以上の対象の比較 | A と B を軸ごとに | `Comparison` |
| システム構成・役割の連なり | 利用者 → サービス → 基盤 → ツール群 | `Architecture` |
| 要素のまとまり・範囲 | 「ここまでが第1段階」 | `Group` |
| 覚えて帰る要点1つ | 目標の数値 | `EmphasisBox` |
| 補助的な情報の箱 | 定義、前提 | `Box` |
| 分類・状態の短い印 | 「新規」「3件」 | `Label` |
| 図形をつなぐ | 部品の間 | `Arrow`、`Connector` |

同じ概念が複数のスライドに出るときは、同じ部品・同じ並び・同じラベルで描き、`highlight`（今の話題）や `overlay`（範囲の重ね合わせ）だけを変える。

## 部品

すべて Vue コンポーネント。`slides.md` の中に HTML タグとして書く。配列やオブジェクトを渡す属性は `:items="[...]"` のように `:` を付ける。

### Step

```html
<Step :items="['要件定義', '設計', '実装', 'テスト']" />
<Step dir="v" :items="[{ label: '第1段階', sub: '約50項目' }, { label: '第2段階', sub: '約150項目' }]" :highlight="[0]" />
```

| 属性 | 意味 |
|---|---|
| `items` | 文字列か `{ label, sub }` の配列 |
| `dir` | `h`（横、既定）／`v`（縦） |
| `highlight` | 強調する要素の番号（0始まり）の配列 |
| `accent` | 強調の色 `1`／`2`／`3`（既定 `1`） |

### Branch

```html
<Branch from="テストの失敗" :to="[{ label: '不具合', tag: '修正' }, { label: '仕様変更', tag: 'テストを更新' }, { label: '不安定', tag: '隔離して調査' }]" />
```

| 属性 | 意味 |
|---|---|
| `from` | 起点の文字列 |
| `to` | 文字列か `{ label, sub, tag }` の配列。`tag` は右端の短い印（件数・条件） |
| `highlight` | 強調する分岐先の番号の配列 |
| `row` | 分岐先1行の高さ px（既定 64。ラベルが2行になるなら 80） |

### Layer

```html
<Layer :layers="[{ label: '成果物', sub: '目的の達成' }, { label: 'ワークフロー' }, { label: '基盤' }]" :highlight="[1]" />
```

| 属性 | 意味 |
|---|---|
| `layers` | 上から順。文字列か `{ label, sub, accent }`。`accent` を付けた層には薄い下地 |
| `highlight` | 強調する層の番号の配列 |

### Comparison

```html
<Comparison
  :columns="[{ title: 'A', items: ['広い', 'あり'] }, { title: 'B', items: ['狭い', 'なし'] }]"
  :axes="['対応範囲', '社内の実績']"
  :highlight="[0]" />
```

| 属性 | 意味 |
|---|---|
| `columns` | `{ title, items }` の配列。`items` は軸ごとの値 |
| `axes` | 行の見出し（比較の軸）。省略可 |
| `highlight` | 今話している列の番号の配列。勝敗の意味で使わない |

軸が4つを超える、列が3つを超えるときは `md-wide` に置く。

### Architecture

```html
<Architecture
  :chain="['利用者', '要求・仕様', { label: 'エージェント', children: ['ファイル', 'ターミナル', '外部サービス'] }]"
  :highlight="['エージェント']"
  :overlay="{ label: 'パッケージ化された範囲', items: ['要求・仕様', 'エージェント'] }" />
```

| 属性 | 意味 |
|---|---|
| `chain` | 上から下へつながる要素。文字列か `{ label, sub, children }`。`children` は右に扇状に並ぶ |
| `highlight` | 強調する要素のラベルの配列 |
| `overlay` | `{ label, items }`。`items` の要素に薄い下地を敷き、右上に `label` を示す。「同じ図の上に範囲を重ねる」ときに使う |

話が進むにつれて同じ `chain` のまま `highlight` と `overlay` を変える。`chain` を毎回組み直さない。

### Group

```html
<Group title="第1段階" accent="1">
  <Box>ログイン</Box>
  <Box>画面遷移</Box>
</Group>
```

`title` は枠の左上。`dir="v"` で中身を縦に並べる。`accent` で枠と薄い下地に色。

### Box・EmphasisBox・Label

```html
<Box title="定義">Context = モデルに渡される情報の全体</Box>
<EmphasisBox title="目標">リリース前の手作業 3日 → 2日</EmphasisBox>
<Label text="3件" /> <Label text="仮定" accent="3" />
```

- `Box`: 白背景・細い境界線。`accent` で境界線に色（グループ分け用）
- `EmphasisBox`: 2px の境界線・28px。1スライドに1つまで
- `Label`: 18px の短い印。`accent` で枠と文字に色

### Arrow・Connector

```html
<Arrow dir="right" :length="48" label="指示" />
<Connector dir="v" :length="32" />
```

`dir` は `right`／`down`／`left`／`up`（Connector は `h`／`v`）。`strong` で 2px。部品の間に置くときに使う。Step・Branch・Architecture は内部で矢印を持つので、外から足さない。

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
  primary: '#4F6D7A'
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

`htmlAttrs.lang` は入力の言語に合わせる。

### 各スライド

`---` で区切り、直後の frontmatter に `layout`・`title`・`conclusion` を書く。本文は Markdown。`::figure::` の後が右側の図。末尾の HTML コメントが発表者ノート。

```markdown
---
layout: md-standard
title: 最上位の箇条書きの文
conclusion: 下の階層から導いた結論
---

- 説明1
- 説明2
  - 補足
- 説明3

::figure::

<Step :items="['A', 'B', 'C']" :highlight="[1]" />

<!--
- 画面から外した根拠や例
- 次のスライドへのつなぎ
- 想定時間: 60秒
-->
```

| frontmatter | 意味 |
|---|---|
| `layout` | `md-cover`／`md-toc`／`md-section`／`md-standard`／`md-wide` |
| `title` | タイトル。`md-section` ではセクション名（目次とフッターに使われる） |
| `conclusion` | 結論行。`md-standard`／`md-wide` で使う |
| `subtitle` | `md-cover`／`md-section` の副題 |
| `figureWidth` | `md-standard` の図の幅。`"33%"`〜`"55%"` |
| `section` | フッターのセクション名を手で指定するとき |

YAML の値にコロン（`:`）や `#` が入るときは引用符で囲む。

### 書かないこと

- `<style>` ブロック、`class="text-sm"` のような文字サイズや色の指定
- 部品の見た目を変える属性（存在しない）。足りない表現は部品側に足す
- Slidev 組み込みの `layout: two-cols` など。レイアウトは同梱の5つだけを使う
- 1スライドに複数の `conclusion`
- 図を2つ（内容が2つあるなら分割を提案する）

### 目次と結び

- 目次（`layout: md-toc`）は frontmatter だけでよい。`md-section` の `title` を自動で並べる
- 結び（まとめ・呼びかけ）は入力にあるときだけ、`md-standard` か `md-wide` で作る。専用のレイアウトは無い

### 表とコード

入力に Markdown の表があれば、軸が明確なら `Comparison` に、そうでなければ Markdown の表のまま `md-wide` に置く（`style.css` が同じ線・文字サイズにする）。コードブロックはそのまま書く。文字は 18px になるので、1ブロック 12 行程度までにし、超えるなら要点の行だけにする。
