---
name: project-design-harness
description: docs/project-definition.md を入力に、そのプロジェクトの開発を担う Agent とハーネス一式を Claude Code 向けに生成する。.claude/ 以下の subagent 定義・settings.json の permissions と hooks・書き込み境界や完了ゲートの hook スクリプト・プロジェクト skill、ルートの CLAUDE.md と .mcp.json、根拠記録 docs/agent-architecture.md を作る。Harness Engineering の考え方（タスク契約、地図、道具の関門、永続状態、承認と禁止、完了の証拠、回復、観測）に基づき、土台＋6段階のレベルから重さを選べる。「ハーネスを作って」「Agent を用意して」「.claude を整えて」「開発を Agent に任せられる状態にして」と言われたとき、project-design-opening（新規）か project-design-reboot（既存プロジェクト）でプロジェクト定義を作り終えた直後に、必ずこの Skill を使う。「ハーネスのレベルを上げたい／下げたい」「プロジェクト定義が変わったので作り直したい」という再実行にも使う。機能・要件・システム設計といったプロジェクトの設計判断はしない。Claude Code 専用。
---

# プロジェクトのハーネス設計

プロジェクト定義を入力に、そのプロジェクトの開発を担う Agent と、それを取り巻くハーネスを生成する Skill。

- **入力**: `docs/project-definition.md`（`project-design-opening` か `project-design-reboot` の成果物。`status: complete` であること）
- **出力**: `.claude/` 以下一式、ルートの `CLAUDE.md` と `.mcp.json`、根拠記録 `docs/agent-architecture.md`
- **扱わないこと**: 機能・要件・システム設計といったプロジェクトの設計判断。プロジェクトの基本情報の聞き取り
- **前提**: Claude Code。Node.js（生成する hook が Node.js のスクリプトであるため）。プロジェクト定義があること（新規プロジェクトなら `project-design-opening`、既存プロジェクトなら `project-design-reboot` で作る）

## この Skill の位置づけ

```text
曖昧なアイデア
  → project-design-opening               プロジェクトの境界を定義する（既存プロジェクトなら project-design-reboot）
  → project-design-harness（この Skill）  開発を担う Agent とハーネスを作る
  → 詳細設計の Skill                      機能・要件・システム設計を詰める
  → 開発
```

Agent の失敗の多くは、推論の失敗ではなく環境の失敗である。どのファイルが大事か分からなかった。前に決めたことを失った。検査を走らせずに成功したと言った。承認が要るはずの操作を実行できてしまった。
指示文を書き直しても変わるのは1回の試行で、環境（ハーネス）を直せば、以後のすべての試行が変わる。この Skill は、その環境を作る。

生成するハーネスは、**設計書駆動の分業**を前提にする。初期の開発だけでなく、その後の変更も、設計文書の更新から始める。
ユーザーと話す主セッションが設計の対話役を務め、コードは実装役の subagent だけが書く。この分担は、指示ではなく仕組み（hook）で守らせる。

考え方の全体は [references/harness-concepts.md](references/harness-concepts.md) にある。**Step 1 に入る前に必ず読む**。以降の判断は、すべてここに書かれた物差しで行う。

## 5つの原則

### 1. 最小のハーネスを作る

最良のハーネスは最大のものではなく、意図と証拠の間の溝を確実に埋める最小の仕組みである。生成する部品の一つひとつについて「これはどの失敗を防ぐのか」に答えられなければ、その部品は生成しない。
外部作用の無い CLI に運用役は要らないし、ツールチェーンが1つのプロジェクトに実装役は1つでよい。雛形にあるからという理由で足さない。
部品は、後で外せるように作る。だから根拠記録に、部品ごとの「防ぐ失敗」を必ず書く。

### 2. 繰り返し大事になる決まりは、指示ではなく仕組みに落とす

`CLAUDE.md` は文脈であって、強制ではない。長い作業の途中で、指示は忘れられる。「実装役は設計文書を書き換えない」「承認なしにデプロイしない」のような、破られたら困る決まりは、hook と permissions に置く。
指示文に残すのは、判断の説明である。なぜその境界があるのか、止められたら次に何をすべきか。

### 3. プロジェクトの設計に踏み込まない。基本情報を聞き直さない

この Skill がユーザーに聞いてよいのは、ハーネス側の判断だけである（レベル、Policy 表、ファイルの計画）。
何を作るのか、どの技術を使うのか、どんなリスクがあるのかは、すべてプロジェクト定義から読む。足りなければ、聞き直さずに止まって、定義を作る Skill（新規なら `project-design-opening`、既存プロジェクトなら `project-design-reboot`）を案内する。聞き取りの手順を2つの Skill に重複させないためだ。
同様に、機能や画面や API の設計はしない。それは次の詳細設計の仕事である。

### 4. 安全の下限は、どのレベルでも外さない

外部作用には承認、不可逆・機微な操作には禁止、ハーネス自身への書き込みには承認、役ごとの書き込み境界。この4つは、ユーザーがどんなに軽いレベルを選んでも生成する。
レベルが変えるのは、契約・地図・許可リスト・状態・検証・回復の厚みであって、安全ではない。

### 5. 書く前に見せる。止められないものは、止められないと書く

権限と hook は、有効になった瞬間からユーザーの環境の振る舞いを変える。だから、生成する前に計画を見せて承認を得る。
そして、仕組みで守れないもの（テストの中から本物の決済 API が呼ばれる、など）を、守れるかのように見せない。Policy 表に「仕組みでは止められない」と明記し、どう守るかを書く。利用者は、自分で守るべき場所を知る必要がある。

## ワークフロー

ユーザーに確認を求めるのは3回だけ。Step 2（レベル）、Step 3（Policy 表）、Step 4（ファイルの計画）。それ以外は、プロジェクト定義と規則から決める。

### Step 0: 前提の点検

次を順に確かめ、1つでも満たさなければ、**何も生成せずに**止まる。

| 確かめること | 満たさないとき |
|---|---|
| `docs/project-definition.md` がある | コードが既にあるなら `project-design-reboot` を、無いなら `project-design-opening` を案内する。この Skill の中で、コードから定義を推定し始めない |
| frontmatter が `status: complete` | 足りない項目を名指しして、定義を作った Skill（区分 F が「既存」なら `project-design-reboot`、そうでなければ `project-design-opening`）の再実行を案内する |
| 区分 A〜G の全行の状態が `decided` / `assumed` / `none` / `deferred` のいずれか | 同上 |
| 区分 C の6項目と区分 D の3項目に `deferred` が無い | 同上。この2区分は、権限と安全策を具体的に書くための材料なので、持ち越しのままでは進めない |
| `node --version` が通る | Node.js の導入を案内する |

点検を通ったら、初回か再実行かを見分ける（[references/merge.md](references/merge.md)）。再実行なら、前回の根拠記録を読み、前回のレベル・Policy 表・役の構成を引き継ぐ出発点にする。

### Step 1: 定義を読み、構成を決める

ここではユーザーに何も聞かない。プロジェクト定義から、次の3つを決める。

1. **Policy**。[references/policy.md](references/policy.md) の手順で、承認する操作と禁止する操作を導く。規則にするのは、**プロジェクト定義に名前が出ている道具**のコマンドだけ。道具が種別でしか書かれていない外部作用（「コンテナを動かせるクラウド」など）は、候補を並べて規則にせず、「道具が未定のため、仕組みでは止められない」として表に載せる。各行に、根拠にしたプロジェクト定義の行を付ける
2. **役の構成と書き込み境界**。[references/agents.md](references/agents.md) の規則で決める。区分 F に「設計文書の場所」の行があれば（既存プロジェクト）、その場所も設計文書の置き場として扱う。基本は主セッション・実装役・調査役。区分 C が構成要素ごとに分かれていれば実装役を分ける。1 で、区分 D を根拠にした承認つきのコマンドが1つ以上できていれば、運用役を足す。構成要素の数は、分ける理由にならない。分けたら、防ぐ失敗を言葉にする
3. **地図とコマンド**。区分 B・F から「知りたいこと → 場所」の対応を、区分 C・E からコマンドの一覧と検証コマンドの名前（例: `pnpm run verify`）を、区分 F から検証コマンドを実行する場所を決める

同じプロジェクト定義からは、同じ構成が出ることを目指す。references の規則で決まらないことを、その場の推測で足さない。決まらなければ、足さない方を選ぶ。

### Step 2: レベルを選んでもらう（確認 1）

[references/levels.md](references/levels.md) を元に、土台と6つのレベルを説明する。説明は部品の名前ではなく、**防げる失敗**で語る。

- 土台は必ず入ること
- 各レベルが防ぐ失敗を1行ずつ
- **標準は L3**。ここから、試作なら下げてよく、本番運用や複数セッションにまたがる作業なら上げるとよいこと、その目安。目安は一般論として示す
- 後から、この Skill の再実行で上げ下げできること
- どのレベルでも安全の下限は同じであること

レベルの選択はユーザーの判断である。L3 はどのプロジェクトにも共通の出発点で、入力によって変えない。プロジェクト定義を見て「あなたの場合は L5 が良い」のような個別の推奨はしない。

### Step 3: Policy 表を確認してもらう（確認 2）

Step 1 で導いた Policy を、表にして**単独で**見せる。ファイルの計画の中に混ぜない。安全の要であり、しかも推論で導いたものなので、人の目で確かめてもらう。

表の各行には、操作、根拠にしたプロジェクト定義の行、階級、扱い（承認／禁止／仕組みでは止められない）、実現する規則を書く。仕組みで止められないものも、同じ表に行として載せる。日常の操作の許可リスト（L3 以上）は安全の判断ではないので、表に混ぜず、下に一覧として添える。書式は [references/policy.md](references/policy.md) の「Policy 表の見せ方」。
確認のときに3点を聞く。承認にした操作のうち禁止にしたいものはあるか。禁止にした操作のうち開発で実際に必要になるものはあるか。表に無い、止めたい操作はあるか。

区分 D が3項目とも `none` で表が短くても、この確認は省かない。「外部作用なし」という前提そのものを、ここで確かめてもらう。

### Step 4: ファイルの計画を承認してもらう（確認 3）

生成・変更するファイルを「新規作成／変更／そのまま」の3分類で見せる（[references/merge.md](references/merge.md)）。新規のプロジェクトでも同じ手順を踏む。
「変更」のファイルには、何を足して何を保つのかを1行で添える。人が書いたものは保つ。

このとき、生成後に起きることを先に伝えておく。

- 主セッションが書くのは `docs/` 以下だけになる。それ以外への書き込みは、編集ツールでもシェルのコマンドでも、ハーネスが止める。コードの変更は実装役に委任することになる。ただし、スクリプトの中で行われる書き込みまでは追えないので、「絶対に書けない」わけではない
- `.claude/` と `.mcp.json` は Claude Code の保護パスなので、生成中に承認の確認が続くことがある
- 関門の hook は、`settings.json` を書いた時点から効き始める。新しく作った `.claude/agents/` の役は、Claude Code を再起動してから使えるようになる

### Step 5: 生成する

雛形は `assets/` にある。レベルごとの生成物の一覧は [references/levels.md](references/levels.md)。

| 雛形 | 生成先 | 入る層 |
|---|---|---|
| `assets/config/harness.json` | `.claude/harness.json`（書き方は [references/harness-config.md](references/harness-config.md)） | 土台 |
| `assets/hooks/write-boundary.mjs`、`assets/hooks/lib/harness.mjs` | `.claude/hooks/` 以下（内容は変えずに写す） | 土台 |
| `assets/hooks/completion-gate.mjs` | 同上 | L5 以上 |
| `assets/hooks/trace.mjs` | 同上 | L6 |
| `assets/agents/implementer.md`、`researcher.md` | `.claude/agents/` | 土台 |
| `assets/agents/operator.md` | 同上 | 条件を満たすとき（[references/agents.md](references/agents.md)） |
| `assets/agents/verifier.md` | 同上 | L5 以上 |
| `assets/skills/task-contract/` | `.claude/skills/task-contract/`（`SKILL.template.md` は `SKILL.md` に名前を変え、同じフォルダの雛形ファイルも写す） | L1 以上 |
| `assets/skills/change-receipt/` | `.claude/skills/change-receipt/`（同上） | L5 以上 |
| `assets/skills/harness-retro/` | `.claude/skills/harness-retro/`（同上） | L6 |
| `assets/rules/area.template.md` | `.claude/rules/<領域>.md` | L2 以上で、コードを置く領域が2つ以上あるときだけ |
| `assets/config/settings.json` | `.claude/settings.json`（統合する） | 土台。hook の登録はレベルに応じて |
| `assets/config/CLAUDE.block.md` | `CLAUDE.md`（目印の間に入れる） | 土台。節はレベルに応じて |
| `assets/docs/agent-architecture.md` | `docs/agent-architecture.md` | 土台 |
| `assets/docs/state.md` | `docs/harness/state.md` | L4 以上 |

生成の決まり。

- **言語**: 雛形は日本語で書かれている。ユーザーが別の言語で会話しているなら、Agent の定義・skill・`CLAUDE.md`・`harness.json` の文言を、その言語に書き換えて生成する。キー、ファイル名、役の名前は変えない
- **置き換え**: 二重波括弧の箇所を、下の「置き換える箇所」の表に従って、プロジェクトの内容で置き換える。置き換える内容が無い節は、節ごと削る。空の節を残さない
- **レベルによる出し分け**: 「if level>=N」と「endif」のコメントで挟まれた部分は、選ばれたレベルが N 以上のときだけ残す。目印のコメントと、雛形の使い方のコメントは残さない
- **hook のスクリプトは書き換えない**。振る舞いは `harness.json` で変える。スクリプトは実際に動かして確かめてあるもので、書き換えると、その確認が無効になる
- **コマンドの承認と禁止は、2つの層に書く**。主役は `harness.json` の `commands`（役ごとに効き、`pnpm exec ...` のような間接実行も捕まえ、Bash と PowerShell を同じ規則で見る）。同じ内容を `settings.json` の `permissions` にも2枚目の網として書く。区分 E の開発環境が Windows なら、`Bash(...)` の規則と同じものを `PowerShell(...)` の形でも書く
- **役ごとのコマンド制限に、subagent 定義の `disallowedTools` を使わない**。`Bash(git push *)` のように書くと、そのコマンドではなく Bash ツールが丸ごと外れ、実装役がテストも実行できなくなる
- **`settings.json`** は、雛形から選ばれたレベルに要る hook の登録だけを取り出し、`"//"` キーをすべて除いて、既存の設定に統合する。`SubagentStop` の `matcher` と `harness.json` の `verify.roles` には、コードを書く役の名前をすべて入れる
- **`.mcp.json`** は、ユーザーが使うと明示した MCP サーバーがあるときだけ作る。プロジェクト定義に外部サービスがあるというだけで、推測で足さない
- **書く順**: `harness.json` → hook のスクリプト → agents → skills → rules → `docs/harness/state.md` → 根拠記録 → `CLAUDE.md` → `.mcp.json` → **最後に `settings.json`**。hook は `settings.json` を書いた時点から効き始めうるので、最後に書く。先に書くと、残りの生成が1つずつ承認待ちになる
- **根拠記録**には、役の一覧、分けた理由、確定した Policy 表、8区分の設計、部品一覧（防ぐ失敗つき）、変更履歴を書く。短く書く。設定値の写しは書かず、ファイルを指す

#### 置き換える箇所

| 記号 | 入れるもの |
|---|---|
| `{{PROJECT_NAME}}` | プロジェクト定義の題名 |
| `{{PURPOSE_ONE_LINE}}` | 区分 A の目的を1文に縮めたもの |
| `{{DESIGN_DIRS}}` | 設計文書の置き場。通常は「`docs/` 以下」。区分 F に「設計文書の場所」があれば、それも含める（例:「`docs/` と `design/` 以下」） |
| `{{EXTRA_DELEGATIONS}}` | 基本の役のほかに作った役への委任の文。検証役があれば「。実装の結果の検証は `verifier` へ」、運用役があれば「。外部作用のある操作は `operator` へ」。無ければ空 |
| `{{TOOLCHAIN_COMMANDS}}` | 区分 C から確定しているコマンド（依存の導入、L5 以上なら検証コマンド）。推測のコマンドは入れない |
| `{{VERIFY_COMMAND}}`、`{{VERIFY_CWD}}` | `harness.json` の `verify` と同じ値。実行場所がルートなら「プロジェクトのルート」。L4 以下では、これらを含む行ごと削る |
| `{{FORBIDDEN_FOR_IMPLEMENTER}}` | `commands` のうち、実装役が実行できないもの全部（`deny` のすべてと、`roles` に実装役が入っていない `ask`）を、`label` の箇条書きで。1つも無ければ、その節ごと削る |
| `{{APPROVAL_REQUIRED_ACTIONS}}`、`{{APPROVAL_REQUIRED_SUMMARY}}` | `commands` の `ask` を、`label` の箇条書き（SUMMARY は読点でつないだ1行）で。無ければ「なし」 |
| `{{PROHIBITED_SUMMARY}}` | `commands` の `deny` と、秘密情報ファイルの読み取りを、1行で |
| `{{OPERATIONS_SUMMARY}}`、`{{OPERATIONS_LIST}}` | 運用役の担当。`ask` のうち、根拠が区分 D か E の行。共通の行は含めない |
| `{{MAP_ROWS}}` | 区分 B・F から作る「知りたいこと → 場所」の行 |
| `{{COMMAND_ROWS}}` | `{{TOOLCHAIN_COMMANDS}}` と同じ内容を、表の行で |
| `{{AREA_*}}` | `assets/rules/area.template.md` の冒頭のコメントに従う |

### Step 6: 動くことを確かめる

完了には証拠が要る。これは、この Skill 自身の仕事にも当てはまる。生成したと言う前に、次を実行して確かめる。

1. JSON として読めること。`.claude/harness.json`、`.claude/settings.json`、（あれば）`.mcp.json`
2. hook のスクリプトが構文として正しいこと。`node --check .claude/hooks/write-boundary.mjs` など
3. 関門が、意図どおりに判定すること。標準入力に JSON を渡して hook を直接動かす。プロジェクトのルートで実行する。入力には必ず `"harness_probe":true` を付ける。付けないと、確認のための呼び出しがトレースに記録される

```bash
# 主セッションがコードを書こうとする → deny が返る
echo '{"harness_probe":true,"tool_name":"Write","tool_input":{"file_path":"src/probe.txt"}}' | node .claude/hooks/write-boundary.mjs
# 実装役が設計文書を書こうとする → deny が返る
echo '{"harness_probe":true,"agent_id":"t","agent_type":"implementer","tool_name":"Edit","tool_input":{"file_path":"docs/project-definition.md"}}' | node .claude/hooks/write-boundary.mjs
# 実装役がシェル経由で設計文書を書こうとする → deny が返る
echo '{"harness_probe":true,"agent_id":"t","agent_type":"implementer","tool_name":"Bash","tool_input":{"command":"echo x > docs/project-definition.md"}}' | node .claude/hooks/write-boundary.mjs
# 主セッションが設計文書を書く → 何も出力されない（通過）
echo '{"harness_probe":true,"tool_name":"Write","tool_input":{"file_path":"docs/probe.md"}}' | node .claude/hooks/write-boundary.mjs
```

   `commands` に規則を入れた場合は、その1つずつについて、主セッションで `ask`（または `deny`）、実装役で `deny` が返ることを、`"tool_name":"Bash"` と実際のコマンドの形で確かめる。直接の形だけでなく、間接実行（`pnpm exec ...`、`docker compose exec ...`）と、別の書き方（`git -C <場所> push`、`bash -c "..."`）でも確かめる。あわせて、似ているが無害なコマンド（`git log --grep push`、`git commit -m "... git push ..."`）が通過することも確かめる。
   実装役を分けた場合は、それぞれの役で、自分の場所に書けて、他の役の場所に書けないことも確かめる
4. 部品一覧に載せたファイルが、すべて実在すること。載せていないファイルを生成していないこと

期待と違う結果が出たら、原因を直してから報告する。確かめていない項目を、確かめたことにしない。

### Step 7: 結果を伝える

短く伝える。生成した全ファイルの中身を見せる必要はない。

- 選ばれたレベルと、作った役
- 承認が要る操作と、禁止した操作の要点。**仕組みでは止められないもの**は必ず伝える
- Claude Code を再起動すること。関門の hook は既に効いているが、新しく作った `.claude/agents/` の役は、再起動してから使えるようになる
- 再起動後の使い方。主セッションに設計や変更を相談すると、設計文書を更新したうえで実装役に委任する流れになること
- L5 以上なら、最初のタスクで検証コマンドを用意することになること。検証コマンドを実行する場所（`harness.json` の `verify.cwd`）と、そこに用意すべきもの
- 次の段階は詳細設計であること。レベルを変えたくなったら、この Skill をもう一度実行すればよいこと

## 避けるパターン

| パターン | 避ける理由 |
|---|---|
| プロジェクトの基本情報をユーザーに聞き直す | 聞き取りは、定義を作る Skill（`project-design-opening`、`project-design-reboot`）の仕事。重複させると、片方を直したときにもう片方がずれる。足りなければ止まって案内する |
| 構成要素ごとに Agent を作る（Web 担当、API 担当、DB 担当） | 構成要素の数は分ける理由にならない。分ける引き金は、ツールチェーンの違いとリスク階級の違いだけ |
| 雛形にある部品を、全部生成する | 防ぐ失敗が無い部品は、摩擦だけを足す。運用役、`.mcp.json`、パス別のローカル指示は、条件を満たすときだけ |
| 決まりを `CLAUDE.md` に書いて済ませる | 文脈は強制ではない。破られたら困る決まりは、hook と permissions に落とす |
| `CLAUDE.md` に設計や説明を書き込む | `CLAUDE.md` は地図であって説明書ではない。毎セッション読み込まれるので、長いほど守られなくなる。中身は `docs/` に置いて指す |
| 広い許可を入れる（`Bash(pnpm *)`、`Bash(git *)`、`Bash(docker *)`） | 公開や push まで通ってしまう。許可は下位コマンドに絞る |
| 役ごとのコマンド制限に `disallowedTools` を使う | `Bash(...)` の形で書くと、Bash ツールが丸ごと外れる。役ごとの制限は `harness.json` の `commands` で行う |
| 道具が未定の外部作用に、候補の CLI を並べて規則にする | 当たらない規則は網にならず、守られているという誤った印象を与える。「道具が未定」と表に書き、決まったら再実行する |
| Policy 表に、根拠を書けない行を足す | 同じ定義から、実行のたびに違う Policy が出る。共通の行を除き、根拠のある行だけを入れる |
| 止められない事故を、規則で止められるように見せる | 利用者が、自分で守るべき場所を見落とす。Policy 表に「仕組みでは止められない」と書く |
| 計画を見せずに書き込む | 権限と hook は、有効になった瞬間から振る舞いを変える。人が書いた設定を壊すおそれもある |
| hook のスクリプトを、その場で書き換える | 動作を確かめた状態でなくなる。振る舞いは `harness.json` で変える |
| 確かめずに「生成しました」と報告する | 走らせていない検査を、通ったことにしない。Step 6 を実行する |
| 安全の下限を、レベルや利用者の希望で外す | 下限は選択の対象ではない。緩めたいなら、プロジェクト定義の区分 D を先に直す |
