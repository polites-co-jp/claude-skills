# `.claude/harness.json` の書き方

hook の振る舞いは、すべてこのファイルで決まる。hook のスクリプトは書き換えない。
雛形は `assets/config/harness.json`。JSON にはコメントを書けないので、段階ごとに何を足すかはここにまとめる。段階の番号は内部用で、利用者には見せない（呼び名は [levels.md](levels.md)）。

## 全体の形

```json
{
  "schema": "harness-config/1",
  "level": 5,
  "protected": ["**/.claude/**", "**/CLAUDE.md", "**/CLAUDE.local.md", ".mcp.json"],
  "pathSets": {
    "design": ["docs/**"],
    "tests":  ["tests/**", "test/**", "e2e/**", "**/__tests__/**", "**/*.test.*", "**/*.spec.*", "**/*_test.*", "**/test_*.*"]
  },
  "roles": {
    "main":        { "write": ["-**", "+@design"], "onDeny": "…" },
    "implementer": { "write": ["+**", "-@design", "+docs/harness/**", "-@tests"], "onDeny": "…" },
    "test-writer": { "write": ["-**", "+@tests", "+docs/harness/**"], "onDeny": "…" },
    "reviewer":    { "write": ["-**"], "onDeny": "…" },
    "verifier":    { "write": ["-**"], "onDeny": "…" },
    "researcher":  { "write": ["-**"], "onDeny": "…" },
    "*":           { "write": ["-**"], "onDeny": "…" }
  },
  "commands": [
    { "match": "git push * --force*", "decision": "deny", "label": "強制 push" },
    { "match": "git push", "decision": "ask", "label": "リモートへの push" }
  ],
  "messages": { "…": "…" },
  "verify": {
    "command": "pnpm run verify",
    "cwd": ".",
    "timeoutSec": 900,
    "roles": ["implementer"],
    "maxBlocks": 3,
    "handbackMarker": "HANDBACK:"
  },
  "trace": { "enabled": false, "dir": "docs/harness/traces" }
}
```

## キーごとの説明

| キー | 入る層 | 内容 |
|---|---|---|
| `level` | 土台 | 選ばれた段階の番号（0〜6。土台だけなら 0）。hook は参照しない。再実行のときに前回の選択を知るための記録。利用者には番号ではなく呼び名で見せる |
| `pathSets.design` | 土台 | 設計文書の置き場。既定は `docs/**`。プロジェクト定義の区分 F に「設計文書の場所」があれば足す |
| `pathSets.tests` | 土台 | テストの置き場。雛形の既定を残したまま、区分 C の言語の慣習と、このプロジェクトの置き場を足す（[agents.md](agents.md)）。ここに入っているパスには、コード実装役は書けず、テスト実装役だけが書ける |
| `protected` | 土台 | ハーネスのファイル。主セッションは承認、subagent は拒否。雛形のまま使う |
| `roles.<名前>.write` | 土台 | 役ごとの書き込み規則。`+` と `-` で始まる並びで、最後に一致したものが勝つ。`@名前` は `pathSets` の一覧を指す。決め方は [agents.md](agents.md) |
| `roles.<名前>.onDeny` | 土台 | 止められた役に返す文。`{role}` と `{path}` が置き換わる。次に何をすべきかまで書く |
| `roles.*` | 土台 | `roles` に無い Agent すべてに当てはまる既定。雛形のまま（どこにも書けない）にする |
| `commands` | 土台 | 承認・禁止するコマンド。決め方と `match` の書き方は [policy.md](policy.md)。無ければ空の配列 |
| `commands[].roles` | 土台 | その `ask` を求められる役。省略時は `["main", "operator"]`。通常は省略する。例外は、未コミットの作業を消す共通の行（`git clean`、`git reset * --hard`）で、コード実装役とテスト実装役もすべて入れる |
| `messages` | 土台 | hook が利用者と Agent に見せる文。雛形は日本語。利用者の言語に合わせて書き換える。`{…}` の置き換え記号は残す |
| `verify` | 段階 5 | 段階 4 以下では `null`。下の節を見る |
| `trace.enabled` | 段階 6 | 段階 5 以下では `false` |

雛形に無い役を足したら（`security-reviewer`、`operator`、ツールチェーンごとに分けた役）、必ず `roles` にも足す。`roles` に無い役は `*` の規則に落ち、どこにも書けない。
読み取り専用の役はそれで正しく動くが、`onDeny` の文がその役向けにならないので、足しておく。
**コード実装役とテスト実装役を分けた場合は、`roles.implementer` と `roles.test-writer` を消して、分けた役をそれぞれ足す**。足し忘れた役は、1行も書けない。

## `verify`（段階 5「終わったと言う前に検査を通す」以上）

| キー | 内容 |
|---|---|
| `command` | 検証を一括で走らせる単一のコマンド。区分 C のパッケージマネージャから決める。スクリプトを定義できるもの（pnpm・npm・yarn など）は `<パッケージマネージャ> run verify`。それ以外は `make verify` のように、入口を1つ用意する。何を走らせるかの中身は、後続の詳細設計と実装が決める。既存プロジェクトで、検証を一括で走らせる入口が既にあると区分 H に書かれていれば、それを使う |
| `commands` | ツールチェーンが複数あるとき、`command` の代わりに使う。`{ "implementer-mobile": "…", "implementer-api": "…" }` のように、役の名前 → コマンド |
| `cwd` | コマンドを実行する場所。プロジェクトのルートからの相対パス。**ツールチェーンが1つなら、常に `.`（ルート）にする**。コードを置く領域が `apps/web` のように下の階層にあっても、ルートから検証を一括で走らせられる入口（ワークスペースのルートの `package.json`、`Makefile` など）を用意するのは、実装役の最初の仕事とする。推測で下の階層を指定しない。ツールチェーンが複数あって実装役を分けた場合も `cwd` は `.` のままにし、`commands` の役ごとのコマンドの側に、その役の領域を含める（例: `pnpm --dir apps/web run verify`、`make -C services/api verify`） |
| `timeoutSec` | 時間切れ。既定 900 |
| `roles` | 検査の対象になる役。**コード実装役の名前をすべて**入れる。テスト実装役は入れない。テストが先の流れでは、テスト実装役が終わる時点でテストが落ちているのが正しく、検査を掛けると永久に終われない。`settings.json` の `SubagentStop` の `matcher` と一致させる |
| `maxBlocks` | 検証が落ちたときに、続けさせる回数の上限。既定 3。超えたら止めて、利用者に通知し、主セッションにも「未検証」を届ける |
| `handbackMarker` | 実装役が、完了を主張せずに差し戻すときの目印。最後のメッセージがこの文字列で始まっていれば、検証を走らせずに止まらせる。既定 `HANDBACK:`。実装役の定義に書いた目印と一致させる |

`verify.command` と `verify.commands` のどちらも無ければ、ゲートは何もしない。
`settings.json` の hook の `timeout`（秒）は、`timeoutSec` より長くする。

検証コマンドがまだ無いプロジェクトでは、実装役が最初に終わろうとしたときにゲートが落ち、「まずこのコマンドを用意せよ」という指示が返る。これは意図した動作である。

## 確かめ方

hook は、標準入力に JSON を渡せば単体で動く。確認のための入力には `"harness_probe": true` を付ける。付けると、トレースにも、「未検証」の通知にも、完了ゲートの試行回数にも記録されない。

```bash
echo '{"harness_probe":true,"tool_name":"Write","tool_input":{"file_path":"src/probe.txt"}}' | node .claude/hooks/write-boundary.mjs
```

出力が無ければ通過。`permissionDecision` が `deny` なら拒否、`ask` なら承認待ち。
