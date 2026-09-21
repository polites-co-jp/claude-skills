# Claude Code の仕様との対応

このスキルの生成物が前提にしている Claude Code の仕様。2026-09-20 に公式ドキュメントで確認した内容と、その出典。
仕様は変わる。生成物が期待どおりに動かないときは、まずここに書いた前提が今も成り立つかを、出典のページで確かめる。

## 目次

- [生成物と仕組みの対応](#生成物と仕組みの対応)
- [hook](#hook)
- [subagent](#subagent)
- [permissions と保護パス](#permissions-と保護パス)
- [CLAUDE.md と rules](#claudemd-と-rules)
- [skill](#skill)
- [既知の限界](#既知の限界)

## 生成物と仕組みの対応

| 生成物 | Claude Code の仕組み |
|---|---|
| 主セッションの役割、地図、安全の決まり | `CLAUDE.md`（プロジェクトのルート） |
| 領域ごとのローカル指示 | `.claude/rules/*.md`（`paths:` つき） |
| 調査・テスト実装・コード実装・コードレビュー・検証・セキュリティレビュー・運用の各役 | `.claude/agents/*.md` |
| 書き込み境界（設計文書・テスト・コードを、役ごとに分ける）、ハーネス保護、コマンドの承認と禁止（役ごと） | `PreToolUse` hook |
| 完了ゲート | `SubagentStop` hook。未検証の通知は `PostToolUse`（`Agent` ツール）hook |
| トレース | `SubagentStart` / `SubagentStop` hook と、上の2つの hook からの追記 |
| 承認と禁止の2枚目の網、秘密情報ファイルの読み取り禁止、許可リスト | `.claude/settings.json` の `permissions` |
| タスク契約、変更レシート、振り返り | `.claude/skills/*/SKILL.md` |
| 外部ツール | `.mcp.json`（プロジェクトのルート） |
| 永続状態の読み込み | `CLAUDE.md` の `@path` インポート |

## hook

出典: <https://code.claude.com/docs/en/hooks.md>

**登録**は `settings.json` の `hooks` に、イベント名 → `{ matcher, hooks: [ハンドラ] }` の配列で書く。

**実行形式**。パスの置き換え（`${CLAUDE_PROJECT_DIR}`）を使うときは、`args` を付けた実行形式にする。シェルを介さないので、引用符や OS の違いを気にしなくてよい。

```json
{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/write-boundary.mjs"], "timeout": 10 }
```

`args` が無い場合はシェル形式になり、Windows では Git Bash（無ければ PowerShell）で実行される。このスキルは実行形式だけを使う。

**`matcher`** は、ツール系のイベントではツール名に、`SubagentStart` / `SubagentStop` では Agent の種類（名前）に照合される。英数字と `_`、`-`、空白、`,`、`|` だけなら、完全一致か `|` 区切りの一覧。それ以外の文字を含むと正規表現になる。

**入力**は標準入力に JSON で渡される。共通の項目は `session_id`、`transcript_path`、`cwd`、`permission_mode`、`hook_event_name` など。
subagent の中で発火したときは `agent_id` と `agent_type` が加わる。`agent_id` は subagent の中でだけ付くので、**`agent_id` が無ければ主セッション**と判定できる。`agent_type` は Agent の名前。
設定ファイルに登録した hook は、subagent の中のツール呼び出しでも発火する。

**`PreToolUse` の判定**は、終了コード 0 で次の JSON を標準出力に出す。

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "理由" } }
```

- `permissionDecision` は `allow` / `deny` / `ask` / `defer`。`deny` は呼び出しを止め、理由は Claude に渡る。`ask` は利用者に確認を求め、理由は利用者に表示される（Claude には渡らない）
- hook の `ask` は、auto モードでも確認を強制する
- 複数の hook が違う判定を返したときの優先は `deny` > `defer` > `ask` > `allow`
- 何も出力せず終了コード 0 なら判定なしで、通常の権限の流れに進む
- 終了コード 2 でも止められる（理由は標準エラー出力）。このスキルは、理由の届け先を制御できる JSON の形を使う

**`Stop` / `SubagentStop` の判定**。

```json
{ "decision": "block", "reason": "次の指示として渡す文" }
```

- `SubagentStop` で `decision: "block"` を返すと、subagent は止まらずに動き続け、`reason` が次の指示として渡る
- 入力には `stop_hook_active`、`agent_id`、`agent_type`、`agent_transcript_path`、`last_assistant_message` が含まれる
- `Stop` は、連続 8 回の block で Claude Code が打ち切る。このスキルの完了ゲートは、それより手前の独自の上限（`maxBlocks`、既定 3）で止めて、人に伝える
- 判定を伴わない通知は、`{ "systemMessage": "..." }` で利用者に表示できる。これは利用者への表示で、主セッションのモデルには届かない
- subagent が終わったあとに主セッションへ文脈を足すには、`Agent` ツールに対する `PostToolUse` hook で `hookSpecificOutput.additionalContext` を返す。完了ゲートは、検証が通らないまま打ち切った事実を、この経路で主セッションに届ける
- subagent が報告を専用のツール（`SubagentHandback`）で返す構成では、`last_assistant_message` に入るのは締めの文だけになる。差し戻しの目印（`HANDBACK:`）を `last_assistant_message` から読む仕組みは、この場合に目印を見落とすことがある。見落としても、ゲートは上限回数で必ず止まる

**反映の時期**。設定ファイルの hook を直接編集した場合、通常はファイルの監視で自動的に反映される。つまり、生成の途中で `settings.json` を書いた時点から、そのセッションでも書き込み境界が効き始めうる。

**時間切れ**の既定は、command 形式で 600 秒。完了ゲートは検証コマンドを走らせるので、`timeout` を検証コマンドの上限より長くする。

**subagent 定義の中の hook**（frontmatter の `hooks`）は、その subagent が動いている間だけ効く。そこに書いた `Stop` は `SubagentStop` に変換される。このスキルは、登録を一箇所で見渡せるように `settings.json` に集める。

## subagent

出典: <https://code.claude.com/docs/en/sub-agents.md>

- `.claude/agents/` の中のファイルの追加と編集は、数秒で検出されて次の委任から使われる。ただし、セッションの開始時に `.claude/agents/` ディレクトリ自体が無かった場合は、再起動するまで読み込まれない
- 置き場は `.claude/agents/<name>.md`。frontmatter と本文からなり、本文がシステムプロンプトになる。Claude Code 本体のシステムプロンプトは、subagent には渡らない
- **自作の subagent には、主セッションと同じ `CLAUDE.md` の階層が読み込まれる**（組み込みの Explore と Plan、および `omitClaudeMd: true` を指定した subagent を除く）。したがって `CLAUDE.md` に「あなたは設計の対話役で、コードは委任する」と書くと、それは実装役の文脈にも入る。このスキルの生成ブロックが冒頭で「あなたはどの役か」を場合分けしているのは、このためである。`omitClaudeMd` は使わない。利用者が `CLAUDE.md` に書いた決まり（コーディング規約など）まで、subagent に届かなくなる
- 主な frontmatter: `name`（必須）、`description`（必須。いつ委任するか）、`tools`（許可リスト。省略するとすべて継承）、`disallowedTools`、`model`（`inherit` で主セッションと同じ）、`maxTurns`、`skills`、`mcpServers`、`hooks`、`permissionMode`、`isolation`
- **`disallowedTools` に `Bash(git push *)` のような指定つきの項目を書くと、一致するコマンドだけでなく Bash ツールが丸ごと外れる**。特定のコマンドを止めるには `permissions.deny` を使え、と公式に書かれている。ただし `permissions` は役ごとに分けられない。このスキルが役ごとのコマンド制限を hook で行うのは、このためである
- `tools` は `Read, Grep, Glob` のようにカンマ区切りで書く
- **subagent は `AskUserQuestion` を使えない**。`tools` に書いても外される。subagent にした役は、ユーザーに質問できない
- **subagent は、既定でバックグラウンドで動く**（v2.1.198 以降）。バックグラウンドの subagent が承認の要る操作に当たると、確認は主セッションに出て、どの subagent が求めているかが示される（v2.1.186 以降）。それより古い版では、確認が出ないまま自動で拒否されていた。運用役が承認つきの操作を実行できるのは、この動作が前提である。運用役の定義には、確認が出ないまま拒否されたら、繰り返さずに返す、と書いてある
- subagent は subagent を呼べる（既定で主セッションの下に 3 層まで）
- `--agent <name>` で主セッション自体を Agent にすると、Agent のシステムプロンプトが Claude Code 既定のものを置き換える。このスキルはこの方法を使わない

## permissions と保護パス

出典: <https://code.claude.com/docs/en/permissions.md>、<https://code.claude.com/docs/en/permission-modes.md>

規則の書き方は [policy.md](policy.md) の「permissions の書き方」にまとめてある。ここでは、ハーネス自身の保護に関わる点だけ書く。

- Claude Code は、少数のパスへの書き込みを**保護パス**として扱い、自動承認しない。ディレクトリでは `.git`、`.vscode`、`.idea`、`.husky`、`.claude`（`.claude/worktrees` を除く）など。ファイルでは `.mcp.json`、`.claude.json`、`.gitconfig`、`.npmrc`、各種シェルの設定ファイルなど
- 保護パスへの書き込みは、`default` と `acceptEdits` では確認、`auto` では分類器の判断、`dontAsk` では拒否、`bypassPermissions` では許可
- `permissions.allow` の規則では、保護パスへの書き込みを事前承認できない。保護パスの検査は、許可の規則より先に走る。確認の画面には「このセッションでは、Claude が自分の設定を編集することを許可する」の選択肢があり、選ぶと、そのセッションの以後の `.claude/` への書き込みは確認されない
- 保護パスの検査の対象は、編集ツールと、書き込み先が読めるシェルのコマンド（リダイレクト、`tee`、`cp`、`mv` など）である。**スクリプトの中の書き込みは、検査されない**。このスキルは、承認された計画を同梱のスクリプト（`scripts/harness-install.mjs`）で一括して反映することで、ファイルごとの確認を避ける
- **skill の frontmatter の `allowed-tools`** は、その skill を呼び出したターンのあいだ、挙げたツールを確認なしで使えるようにする。利用者が次のメッセージを送ると消える（`AskUserQuestion` への回答は、同じターンの中である）。`Bash(...)` の規則の中の `${CLAUDE_SKILL_DIR}` は、skill のフォルダに置き換わる。本文の側でも同じ変数を使えば、同梱のスクリプトを確認なしで実行できる（出典: <https://code.claude.com/docs/en/skills.md>）。規則に一致しなかった場合は、通常の確認が1回出る
- **`CLAUDE.md` は保護パスに含まれない**。このスキルの書き込み境界 hook は、`CLAUDE.md` を保護対象に加え、さらに subagent からのハーネスへの書き込みを一律に拒否する
- `permissions` の規則はセッション全体に効き、subagent ごとには分けられない
- `Bash(...)` と `PowerShell(...)` は別の規則。PowerShell ツールがある環境（Windows）では、同じ規則を両方の形で書く必要がある。hook はツール名を見て両方を同じ規則で判定するので、この違いの影響を受けない
- `Bash` の規則は、Claude が普通に書く形の呼び出しに一致するだけで、同じプログラムを別の形で呼び出せば一致しない。公式に「安全の境界ではない」と明記されている。公式が挙げる、`Bash(git push *)` で止まらない形は、`git -C . push`、`git -c push.default=current push`、`git 'push'`、`sh -c '...'`、絶対パスでの呼び出し。このスキルの hook は、これらの形（プログラム名の後ろの全体オプション、引用符、シェルに文字列で渡されたコマンド、`eval`、コマンド置換、絶対パス）を読む

## CLAUDE.md と rules

出典: <https://code.claude.com/docs/en/memory.md>

- プロジェクトの `CLAUDE.md` は、ルートか `.claude/CLAUDE.md` に置ける。毎セッションの開始時に文脈へ読み込まれる。強制される設定ではなく、文脈として扱われる。確実に止めたいことは hook に落とす
- 大きさの目安は 1 ファイル 200 行以内。長いと文脈を使い、守られにくくなる
- `@path/to/file` で他のファイルを取り込める。相対パスは、取り込む側のファイルからの相対。コードブロックと `` ` `` で囲んだ中は取り込まれない
- `.claude/rules/*.md` は、frontmatter に `paths:`（glob の一覧）があると、一致するファイルを扱うときだけ読み込まれる。`paths:` が無ければ常に読み込まれる

## skill

出典: <https://code.claude.com/docs/en/skills.md>

- 置き場は `.claude/skills/<name>/SKILL.md`。`description` を見て、Claude が使うかどうかを決める
- 主な frontmatter: `name`、`description`、`allowed-tools`、`disallowed-tools`、`disable-model-invocation`、`user-invocable`、`paths`
- 同じフォルダに置いた雛形などのファイルは、`SKILL.md` から相対パスで参照できる

## 既知の限界

生成したハーネスが**守れないこと**。利用者に隠さず、`docs/agent-architecture.md` の Policy 表にも書く。

| 限界 | 理由 | 緩和 |
|---|---|---|
| シェルのコマンドを介した、役の範囲外への書き込み | hook が読めるのは、書き込み先が引数に現れる形まで（リダイレクト、`tee`、`rm`、`mv`、`cp`、`touch`、`mkdir`、`sed -i`、PowerShell の `Set-Content` や `Remove-Item` など）。スクリプトやプログラムの中で行われる書き込みは、コマンドの文字列からは見えない | 見える形は、役の規則で止める。ハーネスのファイルを名指しした、インタプリタへの直接のコード渡し（`node -e` など）も止める。それ以外のすり抜けは、検証役の却下の基準（スコープ外の変更）とレシートで見つける |
| 別の名前で包まれたコマンド（`package.json` の scripts、シェルの別名、自作のスクリプト） | hook が照合するのは、コマンドの文字列に現れる語 | 実装役の定義で禁じ、scripts の変更を検証役とレシートで見つける |
| 変数や文字列の連結で組み立てられたコマンド（`c=push; git $c` など） | hook は、シェルの変数展開を再現しない | 意図的な回避であり、実装役の定義で禁じる。検証役の却下の基準で見つける |
| 実行されるコードの中身（テストの中から本物の外部 API を呼ぶ、など） | 権限の規則が効くのは、ツールの呼び出しまで | 本番の秘密情報を開発環境に置かない。[policy.md](policy.md) の「仕組みでは止められないもの」 |
| `bypassPermissions` モードでの確認 | このモードは確認を省く。保護パスへの書き込みも許可される | このモードを使わない。hook の `deny` は、モードに関係なく効く。`ask` がこのモードで確認を出すかどうかは未確認 |
| `CLAUDE.md` の指示が守られること | `CLAUDE.md` は文脈であって、強制ではない | 繰り返し大事になる決まりは hook と permissions に落とす |
| 主セッションが委任せず、自分で `docs/` 以外を書こうとすること | 指示だけでは防げない | 書き込み境界 hook が止める。止められたときのメッセージで、契約を書いて委任するよう案内する |
| 利用者が手で `.claude/` を書き換えること | 人の編集は hook を通らない | 防がない。人はハーネスの持ち主である。再実行のとき、部品一覧と実体のずれとして検出する |
| Node.js が無い環境 | hook は Node.js のスクリプト | 生成の前に `node --version` を確かめ、無ければ導入を案内して止まる |
