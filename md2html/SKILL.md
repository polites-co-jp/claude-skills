---
name: md2html
description: プロジェクトの docs/ 以下の Markdown を、docs/html/ 以下の HTML に変換し続ける仕組みを入れる。変換は LLM ではなく同梱の node プログラムが行い、Claude Code の hook（PostToolUse の Write・Edit・MultiEdit）で md の作成・編集のたびに自動で走る。md 同士のリンクは .html に書き換え、アンカーも残す。サイドバーのナビ、シンタックスハイライト、Mermaid、タスクリストに対応する。「docs の md を html にしたい」「ドキュメントを html で見られるようにして」「md を編集したら html も更新されるようにして」と言われたとき、導入済みの md2html を更新したいとき、html と md のずれを確かめたいときに使う。静的サイトジェネレーターの導入、デザインの作り込み、GitHub Pages などへの公開は扱わない。Claude Code 専用。
---

# md2html

`docs/` 以下の md を、同じフォルダ構成のまま `docs/html/` 以下の html にする仕組みを、対象のプロジェクトに入れる Skill。
入れたあとは、Claude が md を作成・編集するたびに hook が変換するので、この Skill をもう一度呼ぶ必要はない。

- **入力**: md の入ったフォルダ（既定は `docs/`）を持つプロジェクト
- **出力**:
  - `.claude/md2html/`：変換器の一式。node だけで動く
  - `.claude/settings.json`：hook の登録
  - `docs/html/`：変換した html と、共通の `_md2html/`（nav.js・style.css）
- **扱わないこと**: 静的サイトジェネレーターの導入、ページのデザインの作り込み、どこかへの公開、CI の設定

## 原則

### 1. html は LLM に書かせない

変換は同梱の [runtime/md2html.mjs](runtime/md2html.mjs) が行う。Claude は html を手で書かず、直すときも md を直す。
html を直接書き換えても、次に md が編集されたときに上書きされる。

### 2. 変換器はプロジェクトの中に置く

setup が変換器を対象のプロジェクトの `.claude/md2html/` にコピーする。
hook も `--check` もそのコピーを相対パスで使う。clone した人や別の端末でも、Skill を入れずにそのまま動く。

### 3. 編集したページだけを変換する

hook が書くのは、編集した md の html と、`_md2html/nav.js`・`_md2html/style.css`、生成した `index.html` だけ。
内容が変わらないファイルは書かないので、git の差分は編集した分に収まる。

## ワークフロー

以下、`<skill>` はこの SKILL.md のあるフォルダ、`<root>` は対象のプロジェクトのルートを指す。

### Step 1: 入力と出力のフォルダを確かめる

- 既定は `docs/` → `docs/html/`。`.claude/md2html/config.json` があれば、前回の設定がそこに入っている
- `docs/` が無い、または依頼者が別のフォルダを指定した場合は、選択式の質問で入力と出力のフォルダを確かめる
- 出力先に、人が書いた html がすでにあっても消されない。消されるのは md2html が生成した html だけ（`<meta name="generator" content="md2html">` で見分ける）

### Step 2: setup を実行する

```bash
node <skill>/scripts/setup.mjs --root <root> [--src docs] [--out docs/html]
```

setup が行うのは次の4つ。何度実行してもよい。2回目以降は変換器の更新になる。

1. 変換器を `<root>/.claude/md2html/` にコピーする
2. `config.json` を書く（`--src` / `--out` を省くと、今の設定か既定を使う）
3. `.claude/settings.json` に hook を登録する。ほかの設定と hook はそのまま残す
4. すべての md を変換する

終了コードの意味は次のとおり。

| 終了コード | 意味 | すること |
|---|---|---|
| 0 | 完了 | Step 3 へ |
| 1 | 何も書いていない（引数の誤り、フォルダが無い、settings.json が壊れている） | メッセージのとおりに伝えて止まる |
| 2 | 導入はしたが、切れたリンクがある（または変換に失敗した） | 表示された md の行を見て、リンクを直すか、依頼者に伝える |

### Step 3: 報告する

報告には次の4点を書く。

- 生成した html の数と、入口（`docs/html/index.html`）
- 切れたリンクがあれば、その一覧
- **hook が発火するのは、Claude が Write・Edit で md を書いたときだけ**であること
  - エディタでの手動編集や git pull のあとは、`node .claude/md2html/md2html.mjs --all` で追いつく
- md と html のずれは `node .claude/md2html/md2html.mjs --check` で確かめられる。ずれがあると終了コード 1

hook の登録は、Claude Code の次のセッションから効く。今のセッションで効かなければ、`/hooks` を開くか、セッションを開き直すよう伝える。

`.claude/md2html/` と `docs/html/` はコミットする前提。コミットするかどうかは、プロジェクトの規約と依頼者の指示に従う。

## 変換の規則

| 対象 | 変換後 |
|---|---|
| srcDir の中の md へのリンク（`other.md#節`） | `other.html#節`。アンカーはそのまま |
| ページ内のアンカー（`#節`） | そのまま。見出しの id は GitHub と同じ規則で付けるので、GitHub 向けに書いたリンクが効く |
| 画像や PDF など、md 以外への相対リンク | html の位置から元のファイルを指すパス。ファイルはコピーしない |
| srcDir の外の md（例：`../README.md`） | 元の md を指すパス |
| `https://…` などの絶対 URL、`/` で始まるパス | そのまま |
| リンク先が無い | md へのリンクは元のまま残す。それ以外は書き換える。どちらも警告を出す |

- **タイトル**（`<title>` とナビの表示名）: frontmatter の `title`、無ければ最初の h1、それも無ければファイル名
- **frontmatter**: 本文には出さない
- **コード**: highlight.js（主要な約35言語）で色を付ける。ほかの言語は色なしで出す
- **Mermaid**: ` ```mermaid ` を含むページにだけ、jsDelivr から mermaid.js を読む。オフラインでは図にならず、図のソースが見える
- **index.html**: srcDir に `index.md` があればそれを変換する。無ければページの一覧を生成する
- **対象外**: `.` で始まるフォルダ、`node_modules`、出力先のフォルダ

## hook の振る舞い

`PostToolUse`（`Write|Edit|MultiEdit`）で `node ${CLAUDE_PROJECT_DIR}/.claude/md2html/md2html.mjs --hook` が走る。

- **srcDir の下の md でないとき**: 何もしない
- **ページを変換するとき**: その md の html と共通ファイルを書く。同時に、対応する md が無くなった html を消す（Bash で消した・動かした md の分も、ここで追いつく）
- **切れたリンクがあるとき**: html は書いたうえで、終了コード 2 で場所を伝える（例：`docs/a.md:12 のリンク先 b.md が無い`）。md を直すと、次の hook で html も直る
- **Skill のほうが新しいとき**: 導入済みの Skill（`~/.claude/skills`、`~/.agents/skills`、プロジェクトの `.claude/skills`）が `.claude/md2html` より新しければ、セッションごとに1回知らせる。この Skill を呼べば更新できる

## 同梱のライブラリを更新するとき（Skill の保守）

`runtime/vendor/` は [tools/build-vendor.mjs](tools/build-vendor.mjs) が作る。markdown-it と highlight.js を1つのファイルにまとめ、ライセンスも一緒に書き出す。

```bash
cd <skill>/tools && npm install && npm run build
```

変換の結果が変わる変更をしたら、[runtime/version.json](runtime/version.json) の版を上げる。導入先の hook が、更新を知らせるようになる。
