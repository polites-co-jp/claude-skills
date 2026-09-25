# テスト

このリポジトリが持つ自動テストの一覧。フレームワークは使わず、素の Node.js スクリプトを直接実行する。
対象は `project-design-harness` の hook（書き込み境界・完了ゲート）とインストーラ、`md-to-slidev` が同梱する Slidev の部品、`slide-design-review` のスクリプト。
`project-design-opening`・`project-design-reboot` は対話が本体で、決定的な入出力を持たないため、自動テストの対象にしていない。

## 実行方法

前提: Node.js、git（PATH に通っていること）。

```bash
node tests/check-repo.mjs                          # JSON・リンク・置き換え記号・段階の番号の残りを確認
node project-design-harness/tests/hook-scenarios.mjs   # write-boundary / completion-gate hook を約230場面で確認
node project-design-harness/tests/installer.mjs        # scripts/harness-install.mjs を約25場面で確認
node md-to-slidev/tests/build-example.mjs              # 同梱の部品と完成例を静的に点検し、一時プロジェクトで slidev build する
node slide-design-review/tests/scripts.mjs             # PNG の比較・退避と復元・終了コードを確かめ、md-to-slidev の完成例を実際に PNG へ書き出す
```

`build-example.mjs` は `npm install` と `slidev build` を実行するので、ネットワークが要り、1〜2分かかる。
`SKIP_BUILD=1` を付けると静的な点検（使っている layout・component の存在、18px 未満の文字が無いこと、`slides.md` に直書きのスタイルが無いこと）だけを行う。

`slide-design-review/tests/scripts.mjs` も `npm install` と `playwright-chromium` の導入、Chromium での書き出しを行うので、ネットワークが要り、1〜2分かかる。
`SKIP_RENDER=1` を付けると、ブラウザを使わない確認（合成した PNG での画素比較、`snapshot.mjs` の退避・差分・復元、Slidev が無いときの `render.mjs` の終了コード）だけを行う。
Slidev 53 は Node.js 22.12 以上を求めるので、書き出しを含めて実行するときは Node.js 22 以上を使う。

いずれも exit code 0 で終われば成功。失敗した場合は `FAIL` の行に、期待値と実際の値が出る。

## CI

`.github/workflows/ci.yml` が、push と pull request のたびに上の5つと、hook スクリプトの構文チェック、
`npx skills add . --list` によるスキルの検出確認を実行する。

## この構成の理由

`project-design-harness` が生成する hook は、承認と禁止の判定という安全に直結する部分である。判定を変える変更（コマンドの
照合規則、保護ブランチの判定など）が、意図せず別の場面を壊していないかを、変更のたびに機械的に確認できるようにしている
（[docs/decisions/common.md](../docs/decisions/common.md) の C6）。

テストは `spawnSync` で hook のスクリプトを子プロセスとして呼び、標準入力に Claude Code が渡す形の JSON を渡して、
返ってくる判定（`pass` / `ask` / `deny`）を期待値と比べるだけの、ごく単純な作りにしてある。
`hook-scenarios.mjs` は、実行のたびに一時ディレクトリに実際の git リポジトリを作り、ブランチを切り替えながら確認する
（保護ブランチの判定は、実際のブランチの状態を見て決まるため）。テストが終わると一時ディレクトリは削除される。

`md-to-slidev` の部品（layouts・components・style.css）は、生成される `slides.md` から呼ばれる側で、壊れると利用者の手元で初めて
ビルドが落ちる。`build-example.mjs` は同梱の完成例を実際に Slidev でビルドし、部品を直したときの壊れを検知する
（[docs/decisions/md-to-slidev.md](../docs/decisions/md-to-slidev.md) の M10）。

`slide-design-review` のスクリプトは、デザインの改善ループの足場（ページを画像にする、どのページが変わったかを知る、後退した変更を戻す）で、
これが誤ると、レビューが古い画像を見る、ほかのページの後退を見逃す、戻したつもりで戻っていない、といった形でループ全体が静かに壊れる。
`scripts.mjs` は、同じソースの書き出しが一致すること、1枚だけ直すとそのページだけが変わったと出ることを、実際の Slidev と Chromium で確かめる
（[docs/decisions/slide-design-review.md](../docs/decisions/slide-design-review.md) の V13）。レビューの質そのものは機械的なテストの対象にしていない。
