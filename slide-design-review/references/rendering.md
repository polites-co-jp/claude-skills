# 書き出し

ページを画像にする仕組みと、うまくいかないときの対処。

## 仕組み

[scripts/render.mjs](../scripts/render.mjs) は、プロジェクトに入っている Slidev の CLI をそのまま使い、次を実行する。

```bash
slidev export <deck> --format png --scale 1 --output <一時フォルダ> --timeout 60000 --wait 300 [--range <ページ>]
```

- `--scale 1` で、キャンバスと同じ寸法の PNG になる（Slidev の既定は 2 倍）。レビュー役が見る画像は、投影される見た目と同じ比率
- Slidev の `export` は、書き出す前に出力先のフォルダを消す。だから一時フォルダに書かせ、`page-NN.png` に名前を変えて指定のフォルダへ移す。指定のフォルダの中の、ほかのファイルは消えない
- 書き出しと同時に、Slidev のパーサ（`@slidev/parser`）でページ番号とソースの位置（ファイル・行の範囲・layout・タイトル）の対応を作り、`pages.json` に書く。`--list` を付けると、ブラウザを起動せずに対応だけを出す
- ページ番号は、非表示（`hide: true`・`disabled: true`）のスライドを除いた表示上の順番。Slidev の書き出しと同じ数え方
- `src:` で別ファイルから取り込んだページは、`pages.json` の `file` がその取り込み元になる
- クリックで出る要素（`v-click` など）は、すべて出た最後の状態で書き出される

同じソースを2回書き出すと、PNG はバイト単位で一致する（2026-09-25、Slidev 53.0.0 と playwright-chromium 1.63.0 で確認）。だから [scripts/compare-renders.mjs](../scripts/compare-renders.mjs) が「変わった」と言うページは、本当に見た目が変わっている。変わった画素の割合と、変化を囲む矩形も出す。

## 速さ

全ページの書き出しは、13ページのデッキで 6〜8 秒程度（Vite のキャッシュが温まったあと）。最初の1回は依存の最適化で 20 秒前後かかる。修正のたびに全ページを書き出しても、ループの時間の大半は subagent の思考で、書き出しではない。

## playwright-chromium

Slidev の書き出しは Playwright の Chromium で描く。Slidev は `playwright-chromium` を、プロジェクト → ワークスペースのルート → グローバルの順に探す。`render.mjs` も同じ順で探し、見つからなければ終了コード 3 で止まる。

- プロジェクトに入れる: `npm i -D playwright-chromium`（pnpm なら `pnpm add -D playwright-chromium`）。Slidev の公式の手順
- グローバルに入れる: `npm i -g playwright-chromium`
- `@playwright/test` や `playwright` が入っていても、Slidev はそれを使わない。`playwright-chromium` が要る
- ブラウザ本体は `playwright-chromium` の導入時に落ちてくる。落ちていなければ `npx playwright-core install chromium`（Linux で依存ライブラリが足りなければ `--with-deps`）

## うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| 終了コード 2「Slidev のプロジェクトではない」 | デッキのフォルダから上に、`@slidev/cli` を依存に持つ `package.json` が無い。`--deck` の場所を確かめる |
| 終了コード 2「@slidev/cli が入っていない」 | `npm install` がまだ。プロジェクトで install を実行する |
| 終了コード 3 | `playwright-chromium` が無い。上の「playwright-chromium」 |
| 書き出しに失敗（exit 1） | たいていは `slides.md` か部品の構文エラー。出力の末尾 40 行にエラーがある。修正の直後なら実装役に渡す |
| 文字が既定のフォントで描かれる | Web フォント（Google Fonts など）の読み込みが間に合っていない、またはネットワークが無い。Slidev の `fonts` 設定を確かめる。オフラインでは、フォントを `local` にするか、プロジェクトに置く |
| タイムアウト | 重いページ（大きな画像、Monaco、Mermaid）。`--timeout 120000` を足す |
| `Failed to patch FloatingVue` が出る | Slidev 53 の既知のコンソールエラーで、書き出しには影響しない。`render.mjs` は出力から省いている |
| ページ番号がずれている | 非表示のスライドは数えない。`--list` で対応を確かめる |
