# テスト

このリポジトリが持つ自動テストの一覧。フレームワークは使わず、素の Node.js スクリプトを直接実行する。
対象は `project-design-harness` の hook（書き込み境界・完了ゲート）とインストーラ。`project-design-opening`・`project-design-reboot` は
対話が本体で、決定的な入出力を持たないため、自動テストの対象にしていない。

## 実行方法

前提: Node.js、git（PATH に通っていること）。

```bash
node tests/check-repo.mjs                          # JSON・リンク・置き換え記号・段階の番号の残りを確認
node project-design-harness/tests/hook-scenarios.mjs   # write-boundary / completion-gate hook を約230場面で確認
node project-design-harness/tests/installer.mjs        # scripts/harness-install.mjs を約25場面で確認
```

いずれも exit code 0 で終われば成功。失敗した場合は `FAIL` の行に、期待値と実際の値が出る。

## CI

`.github/workflows/ci.yml` が、push と pull request のたびに上の3つと、hook スクリプトの構文チェック、
`npx skills add . --list` によるスキルの検出確認を実行する。

## この構成の理由

`project-design-harness` が生成する hook は、承認と禁止の判定という安全に直結する部分である。判定を変える変更（コマンドの
照合規則、保護ブランチの判定など）が、意図せず別の場面を壊していないかを、変更のたびに機械的に確認できるようにしている
（[docs/decisions/common.md](../docs/decisions/common.md) の C6）。

テストは `spawnSync` で hook のスクリプトを子プロセスとして呼び、標準入力に Claude Code が渡す形の JSON を渡して、
返ってくる判定（`pass` / `ask` / `deny`）を期待値と比べるだけの、ごく単純な作りにしてある。
`hook-scenarios.mjs` は、実行のたびに一時ディレクトリに実際の git リポジトリを作り、ブランチを切り替えながら確認する
（保護ブランチの判定は、実際のブランチの状態を見て決まるため）。テストが終わると一時ディレクトリは削除される。
