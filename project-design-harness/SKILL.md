---
name: project-design-harness
description: docs/project-definition.md を入力に、そのプロジェクトの開発を進めるのに必要な Agent 一揃い（調査、テスト実装、コード実装、コードレビュー、検証、必要ならセキュリティレビューと運用）と、それを取り巻くハーネスを Claude Code 向けに生成する。.claude/ 以下の subagent 定義・settings.json の permissions と hooks・書き込み境界や完了の検査の hook スクリプト・プロジェクト skill、ルートの CLAUDE.md と .mcp.json、根拠記録 docs/agent-architecture.md を作る。Harness Engineering の考え方（タスク契約、地図、道具の関門、永続状態、承認と禁止、完了の証拠、回復、観測）に基づく。「ハーネスを作って」「Agent を用意して」「開発チームの Agent を作って」「.claude を整えて」「開発を Agent に任せられる状態にして」と言われたとき、project-design-opening（新規）か project-design-reboot（既存プロジェクト）でプロジェクト定義を作り終えた直後に、必ずこの Skill を使う。「仕組みを足したい／外したい」「プロジェクト定義が変わったので作り直したい」という再実行にも使う。機能・要件・システム設計といったプロジェクトの設計判断はしない。Claude Code 専用。
allowed-tools:
  - Bash(node "${CLAUDE_SKILL_DIR}/scripts/harness-install.mjs" *)
  - PowerShell(node "${CLAUDE_SKILL_DIR}/scripts/harness-install.mjs" *)
---

# プロジェクトのハーネス設計

プロジェクト定義を入力に、そのプロジェクトの開発を進めるのに必要な Agent 一揃いと、それを取り巻くハーネスを生成する Skill。

- **入力**: `docs/project-definition.md`（`project-design-opening` か `project-design-reboot` の成果物。`status: complete` であること）
- **出力**: `.claude/` 以下一式、ルートの `CLAUDE.md` と `.mcp.json`、根拠記録 `docs/agent-architecture.md`
- **扱わないこと**: 機能・要件・システム設計といったプロジェクトの設計判断。プロジェクトの基本情報の聞き取り
- **前提**: Claude Code。Node.js（生成する hook が Node.js のスクリプトであるため）。プロジェクト定義があること（新規プロジェクトなら `project-design-opening`、既存プロジェクトなら `project-design-reboot` で作る）

## この Skill の位置づけ

```text
曖昧なアイデア
  → project-design-opening               プロジェクトの境界を定義する（既存プロジェクトなら project-design-reboot）
  → project-design-harness（この Skill）  開発を担う Agent 一揃いとハーネスを作る
  → 詳細設計の Skill                      機能・要件・システム設計を詰める
  → 開発
```

Agent の失敗の多くは、推論の失敗ではなく環境の失敗である。どのファイルが大事か分からなかった。前に決めたことを失った。検査を走らせずに成功したと言った。承認が要るはずの操作を実行できてしまった。
指示文を書き直しても変わるのは1回の試行で、環境（ハーネス）を直せば、以後のすべての試行が変わる。この Skill は、その環境を作る。

生成するハーネスは、**設計書駆動の分業**を前提にする。初期の開発だけでなく、その後の変更も、設計文書の更新から始める。
ユーザーと話す主セッションが設計の対話役を務め、テストはテスト実装役が、コードはコード実装役が書き、レビュー役と検証役が別の目で確かめる。この分担は、指示ではなく仕組み（hook）で守らせる。

考え方の全体は [references/harness-concepts.md](references/harness-concepts.md) にある。**Step 1 に入る前に必ず読む**。以降の判断は、すべてここに書かれた物差しで行う。

## 6つの原則

### 1. メンバーは一揃い作る。仕組みは最小から足す

プロジェクトを進めるのに必要な役は、最初から全部作る。設計の対話、調査、テスト実装、コード実装、コードレビュー、検証。利用者がどんなに軽い構成を選んでも、この顔ぶれは変わらない。
開発の工程が欠けたチームでは、欠けた工程を誰かが兼ねることになり、作る側と確かめる側の緊張が消える。

最小から始めるのは、仕組みの方である。契約、地図、許可リスト、状態の引き継ぎ、終わる前の検査、失敗の記録。こちらは、利用者が選んだところまでを入れる。最良のハーネスは最大のものではなく、意図と証拠の間の溝を確実に埋める最小の仕組みである。

どちらについても、部品の一つひとつに「これはどの失敗を防ぐのか」を言えること。言えない部品は生成しない。根拠記録に、部品ごとの「防ぐ失敗」を必ず書く。後で外せるようにするためだ。

### 2. 役は工程で分ける。構成要素では分けない

Web・API・DB という構成だからといって、画面担当・API 担当・DB 担当を作らない。分ける軸は、開発の工程である。
工程で分けると、役ごとに目的を逆にできる。テスト実装役は契約からテストを書き、コード実装役はそれを通し、検証役は落とそうとする。

### 3. 繰り返し大事になる決まりは、指示ではなく仕組みに落とす

`CLAUDE.md` は文脈であって、強制ではない。長い作業の途中で、指示は忘れられる。「コード実装役はテストを書き換えない」「実装役は設計文書を書き換えない」「承認なしにデプロイしない」のような、破られたら困る決まりは、hook と permissions に置く。
指示文に残すのは、判断の説明である。なぜその境界があるのか、止められたら次に何をすべきか。

### 4. プロジェクトの設計に踏み込まない。基本情報を聞き直さない

この Skill がユーザーに聞いてよいのは、ハーネス側の判断だけである（仕組みをどこまで入れるか、Policy 表、ファイルの計画）。
何を作るのか、どの技術を使うのか、どんなリスクがあるのかは、すべてプロジェクト定義から読む。足りなければ、聞き直さずに止まって、定義を作る Skill（新規なら `project-design-opening`、既存プロジェクトなら `project-design-reboot`）を案内する。聞き取りの手順を2つの Skill に重複させないためだ。
同様に、機能や画面や API の設計はしない。それは次の詳細設計の仕事である。

### 5. 安全の下限は、何を選んでも外さない

外部作用には承認、不可逆・機微な操作には禁止、ハーネス自身への書き込みには承認、役ごとの書き込み境界。この4つは、ユーザーがどんなに軽い構成を選んでも生成する。

### 6. 利用者には、具体的な言葉で見せる。止められないものは、止められないと書く

利用者に、段階の番号や記号（「L3」「レベル 5」）を見せない。見せるのは、誰が何をするのか、普段の使い方がどう変わるのか、何を防げるのか、である。番号は内部の記録にだけ使う。
権限と hook は、有効になった瞬間からユーザーの環境の振る舞いを変える。だから、生成する前に計画を見せて承認を得る。
そして、仕組みで守れないもの（テストの中から本物の決済 API が呼ばれる、など）を、守れるかのように見せない。Policy 表に「仕組みでは止められない」と明記し、どう守るかを書く。

## ワークフロー

ユーザーに確認を求めるのは3回だけ。Step 2（仕組みをどこまで入れるか）、Step 3（Policy 表）、Step 4（ファイルの計画）。それ以外は、プロジェクト定義と規則から決める。

### Step 0: 前提の点検

次を順に確かめ、1つでも満たさなければ、**何も生成せずに**止まる。

| 確かめること | 満たさないとき |
|---|---|
| `docs/project-definition.md` がある | コードが既にあるなら `project-design-reboot` を、無いなら `project-design-opening` を案内する。この Skill の中で、コードから定義を推定し始めない |
| frontmatter が `status: complete` | 足りない項目を名指しして、定義を作った Skill（区分 F が「既存」なら `project-design-reboot`、そうでなければ `project-design-opening`）の再実行を案内する |
| 区分 A〜G の全行の状態が `decided` / `assumed` / `none` / `deferred` のいずれか | 同上 |
| 区分 C の6項目と区分 D の3項目に `deferred` が無い | 同上。この2区分は、権限と安全策を具体的に書くための材料なので、持ち越しのままでは進めない |
| `node --version` が通る | Node.js の導入を案内する |

点検を通ったら、初回か再実行かを見分ける（[references/merge.md](references/merge.md)）。再実行なら、前回の根拠記録を読み、前回の選択・Policy 表・役の構成を引き継ぐ出発点にする。

### Step 1: 定義を読み、構成を決める

ここではユーザーに何も聞かない。プロジェクト定義から、次の3つを決める。

1. **Policy**。[references/policy.md](references/policy.md) の手順で、承認する操作と禁止する操作を導く。規則にするのは、**プロジェクト定義に名前が出ている道具**のコマンドだけ。道具が種別でしか書かれていない外部作用（「コンテナを動かせるクラウド」など）は、候補を並べて規則にせず、「道具が未定のため、仕組みでは止められない」として表に載せる。各行に、根拠にしたプロジェクト定義の行を付ける
2. **役の顔ぶれと書き込み境界**。[references/agents.md](references/agents.md) の規則で決める。常に作る役は、調査・テスト実装・コード実装・コードレビュー・検証。区分 D の3項目に `none` でないものがあればセキュリティレビューを、1 で区分 D を根拠にした承認つきのコマンドが1つ以上できていれば運用を足す。区分 C が構成要素ごとに分かれていれば、コード実装とテスト実装をツールチェーンごとに分ける。構成要素の数は、分ける理由にならない。
   テストの置き場は、区分 C の言語の慣習から決める。区分 F に「設計文書の場所」の行があれば（既存プロジェクト）、その場所も設計文書の置き場として扱う
3. **地図とコマンド**。区分 B・F から「知りたいこと → 場所」の対応を、区分 C・E からコマンドの一覧と検証コマンドの名前（例: `pnpm run verify`）を決める。検証コマンドを実行する場所は、ツールチェーンが1つなら常にプロジェクトのルートとする
4. **git の運用**。プロジェクトのルートに `.git` があるか、区分 E にリモートのホスティングがあるかを見る。git で管理されていれば、保護ブランチ（`main`・`master`・`develop`）の規則と、作業ブランチで作業してタスクごとにコミットする流れを入れる。リモートがあれば、作業ブランチへの push も流れに入れる（[references/policy.md](references/policy.md) の手順 4）。区分 E で開発用の DB をコンテナで動かしているなら、compose のサービス名を `harness.json` の `localHosts` に入れる

同じプロジェクト定義からは、同じ構成が出ることを目指す。references の規則で決まらないことを、その場の推測で足さない。決まらなければ、足さない方を選ぶ。

### Step 2: 仕組みをどこまで入れるかを選んでもらう（確認 1）

[references/levels.md](references/levels.md) の「利用者への見せ方」に従って説明する。**番号や記号を出さない**。

1. 最初に、必ず入るものを具体的に言う。メンバーの顔ぶれ（誰が何をするか。このプロジェクトで足した役も含めて）と、このプロジェクトの安全の決まりの要点。ここは選択の対象ではないことも言う
2. 選ぶのは「その上に、仕組みをどこまで入れるか」だと言う。メンバーは変わらない
3. 6つの段階を、呼び名と、普段の使い方がどう変わるかで説明する。このプロジェクトのコマンドや道具の名前で言えるところは、そう言う
4. 標準は「日常の操作で止まらないようにする」であること、軽くする目安と重くする目安。目安は一般論として示す
5. 後から、この Skill の再実行で足したり外したりできること

どこまで入れるかは、ユーザーの判断である。標準はどのプロジェクトにも共通の出発点で、入力によって変えない。プロジェクト定義を見て「あなたの場合はこれが良い」のような個別の推奨はしない。

### Step 3: Policy 表を確認してもらう（確認 2）

Step 1 で導いた Policy を、表にして**単独で**見せる。ファイルの計画の中に混ぜない。安全の要であり、しかも推論で導いたものなので、人の目で確かめてもらう。

表の各行には、操作、根拠にしたプロジェクト定義の行、階級、扱い（承認／禁止／仕組みでは止められない）、実現する規則を書く。仕組みで止められないものも、同じ表に行として載せる。日常の操作の許可リストは安全の判断ではないので、表に混ぜず、下に一覧として添える。書式は [references/policy.md](references/policy.md) の「Policy 表の見せ方」。
確認のときに3点を聞く。承認にした操作のうち禁止にしたいものはあるか。禁止にした操作のうち開発で実際に必要になるものはあるか。表に無い、止めたい操作はあるか。

区分 D が3項目とも `none` で表が短くても、この確認は省かない。「外部作用なし」という前提そのものを、ここで確かめてもらう。

### Step 4: ファイルの計画を承認してもらう（確認 3）

生成・変更するファイルを「新規作成／変更／そのまま」の3分類で見せる（[references/merge.md](references/merge.md)）。新規のプロジェクトでも同じ手順を踏む。
各行に、そのファイルが何のためのものかを一言で添える（「`test-writer.md` — テストを書く役」）。「変更」のファイルには、何を足して何を保つのかを添える。人が書いたものは保つ。

このとき、生成後に起きることを先に伝えておく。

- 主セッションが書くのは設計文書だけになる。テストは `test-writer` に、コードは `implementer` に委任することになる。それ以外への書き込みは、編集ツールでもシェルのコマンドでも、ハーネスが止める。ただし、スクリプトの中で行われる書き込みまでは追えないので、「絶対に書けない」わけではない
- コードを書く役は、テストを書き換えられない。テストを書く役は、本体のコードを書き換えられない
- git で管理されているプロジェクトでは、`main`・`master`・`develop` に直接コミットできなくなる。作業は作業ブランチで行い、タスクごとにコミットして（リモートがあれば）push する。保護ブランチへはプルリクエストで入れる
- 設計文書への書き込み、検索、コンテナの操作、画面テストの実行、接続先がローカルだと分かるテスト DB への操作、作業ブランチへのコミットと push は、承認なしで走るようになる（「日常の操作で止まらないようにする」を入れた場合）
- **この計画を承認したら、あとはファイルごとの確認なしに、一括で書き込む**。ここでの承認が、書き込みの go サインになる。だから計画は、承認の前に、書き込む先と中身の要点が分かるように見せる
- 関門の hook は、`settings.json` を書いた時点から効き始める。新しく作った `.claude/agents/` の役は、Claude Code を再起動してから使えるようになる

### Step 5: 生成する

雛形は `assets/` にある。段階ごとの生成物の一覧は [references/levels.md](references/levels.md)。下の表の「入る段階」の番号は内部用で、利用者には見せない。

| 雛形 | 生成先 | 入る段階 |
|---|---|---|
| `assets/config/harness.json` | `.claude/harness.json`（書き方は [references/harness-config.md](references/harness-config.md)） | 土台 |
| `assets/hooks/write-boundary.mjs`、`assets/hooks/lib/harness.mjs` | `.claude/hooks/` 以下（内容は変えずに写す） | 土台 |
| `assets/hooks/completion-gate.mjs` | 同上 | 5 以上 |
| `assets/hooks/trace.mjs` | 同上 | 6 |
| `assets/agents/researcher.md`、`test-writer.md`、`implementer.md`、`reviewer.md`、`verifier.md` | `.claude/agents/` | 土台 |
| `assets/agents/security-reviewer.md`、`operator.md` | 同上 | 土台。条件を満たすときだけ（[references/agents.md](references/agents.md)） |
| `assets/skills/task-contract/` | `.claude/skills/task-contract/`（`SKILL.template.md` は `SKILL.md` に名前を変え、同じフォルダの雛形ファイルも写す） | 1 以上 |
| `assets/skills/change-receipt/` | `.claude/skills/change-receipt/`（同上） | 5 以上 |
| `assets/skills/harness-retro/` | `.claude/skills/harness-retro/`（同上） | 6 |
| `assets/rules/area.template.md` | `.claude/rules/<領域>.md` | 2 以上で、コードを置く領域が2つ以上あるときだけ |
| `assets/config/settings.json` | `.claude/settings.json`（統合する） | 土台。hook の登録は段階に応じて |
| `assets/config/CLAUDE.block.md` | `CLAUDE.md`（目印の間に入れる） | 土台。節は段階に応じて |
| `assets/docs/agent-architecture.md` | `docs/agent-architecture.md` | 土台 |
| `assets/docs/state.md` | `docs/harness/state.md` | 4 以上 |

生成の決まり。

- **言語**: 雛形は日本語で書かれている。ユーザーが別の言語で会話しているなら、Agent の定義・skill・`CLAUDE.md`・`harness.json` の文言を、その言語に書き換えて生成する。キー、ファイル名、役の名前は変えない
- **置き換え**: 二重波括弧の箇所を、下の「置き換える箇所」の表に従って、プロジェクトの内容で置き換える。置き換える内容が無い節は、節ごと削る。空の節を残さない
- **段階による出し分け**: 「if level>=N」（または「if level<N」）と「endif」のコメントで挟まれた部分は、選ばれた段階の番号が条件を満たすときだけ残す。目印のコメントと、雛形の使い方のコメントは残さない
- **利用者が読む文書に、段階の番号を書かない**。根拠記録の概要、最後の報告では、段階を呼び名で書く。番号を書いてよいのは、`harness.json` の `level` だけ。根拠記録の frontmatter には、呼び名を書く（`mechanisms: 日常の操作で止まらないようにする`）
- **hook のスクリプトは書き換えない**。振る舞いは `harness.json` で変える。スクリプトは実際に動かして確かめてあるもので、書き換えると、その確認が無効になる
- **コマンドの承認と禁止は、2つの層に書く**。主役は `harness.json` の `commands`（役ごとに効き、`pnpm exec ...` のような間接実行も捕まえ、Bash と PowerShell を同じ規則で見る）。同じ内容を `settings.json` の `permissions` にも2枚目の網として書く。区分 E の開発環境が Windows なら、`Bash(...)` の規則と同じものを `PowerShell(...)` の形でも書く
- **役ごとのコマンド制限に、subagent 定義の `disallowedTools` を使わない**。`Bash(git push *)` のように書くと、そのコマンドではなく Bash ツールが丸ごと外れ、実装役がテストも実行できなくなる
- **`settings.json`** は、雛形から選ばれた段階に要る hook の登録だけを取り出し、`"//"` キーをすべて除いて、既存の設定に統合する。`SubagentStop` の `matcher` と `harness.json` の `verify.roles` には、**コード実装役の名前だけ**を入れる。テスト実装役は入れない（テストが先の流れでは、テスト実装役が終わる時点でテストが落ちているのが正しい）
- **`.mcp.json`** は、ユーザーが使うと明示した MCP サーバーがあるときだけ作る。プロジェクト定義に外部サービスがあるというだけで、推測で足さない
- **生成先に直接書かない**。下の「書き込み方」のとおり、下書きを作ってから、同梱のスクリプトで一括して反映する。`settings.json` を最後に書く順番（hook は書いた時点から効き始めうる）は、スクリプトが守る
- **根拠記録**には、役の一覧（防ぐ失敗つき）、確定した Policy 表、8区分の設計、部品一覧（防ぐ失敗つき）、変更履歴を書く。短く書く。設定値の写しは書かず、ファイルを指す

#### 書き込み方: 下書きを作り、一括で反映する

`.claude/` と `.mcp.json` は Claude Code の保護パスで、編集ツールで書くと、1ファイルごとに確認が出る。許可の規則（`permissions.allow`）では、これを消せない。既にこのハーネスが入っているプロジェクトでは、書き込み境界 hook も、ハーネスのファイルへの書き込みごとに承認を求める。
利用者は、Step 4 で計画を承認している。その後に同じ確認を十数回繰り返させない。

1. **下書きを `docs/harness/.staging/` に書く**。生成するファイル1つにつき、下書きを1つ。下書きのファイル名は、生成先のパスの `/` を `__` に替え、各階層の先頭の `.` を外し、末尾に `.staged` を付ける（`.claude/agents/implementer.md` → `claude__agents__implementer.md.staged`、`CLAUDE.md` → `CLAUDE.md.staged`、`.mcp.json` → `mcp.json.staged`）。フォルダは作らない。下書きの置き場に `.claude/` という階層を作ると、それ自体が保護パスとして扱われる
   - 「変更」のファイル（`settings.json`、`CLAUDE.md` など）は、既存の内容を読み、[references/merge.md](references/merge.md) のとおりに統合した**全文**を下書きにする
   - 内容を変えずに写すもの（hook のスクリプト、`receipt.template.md`）は、下書きを書かない。計画ファイルで、スキルの `assets/` からの相対パスを指定する
2. **計画ファイル `docs/harness/.staging/plan.json` を書く**。Step 4 で承認された計画と、同じ内容にする。承認されていないファイルを足さない

   ```json
   { "schema": "harness-install/1",
     "files": [
       { "path": ".claude/harness.json", "action": "create", "staged": "claude__harness.json.staged" },
       { "path": ".claude/hooks/write-boundary.mjs", "action": "create", "asset": "hooks/write-boundary.mjs" },
       { "path": "CLAUDE.md", "action": "update", "staged": "CLAUDE.md.staged" },
       { "path": ".claude/skills/harness-retro/SKILL.md", "action": "delete" }
     ] }
   ```

   `action` は、計画の3分類に対応する。`create`（新規作成。既にあれば失敗する）、`update`（変更。無ければ失敗する）、`delete`（仕組みを外すとき）。「そのまま」のファイルは載せない
3. **スクリプトで反映する**。この Skill のフォルダにある `scripts/harness-install.mjs` を、次の形のまま実行する。引数は、プロジェクトのルート

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/harness-install.mjs" "<プロジェクトのルートの絶対パス>"
   ```

   この形のコマンドは、この Skill の実行中は確認なしで走るように許可してある（frontmatter の `allowed-tools`）。形を変えると（`cd` を前に付ける、引用符を外す、など）、許可に一致せず、確認が1回出る。`${CLAUDE_SKILL_DIR}` が置き換わらずに見えている場合は、この `SKILL.md` があるフォルダの絶対パスに読み替える。確認が出た場合も、出るのはこの1回だけである
4. スクリプトは、書く前にすべてを検査する。置き換え記号や出し分けの目印の残り、JSON の誤り、`"//"` キーの残り、ハーネスの置き場以外への書き込み（`.claude/`、`CLAUDE.md`、`.mcp.json`、`docs/agent-architecture.md`、`docs/harness/` の外）があれば、**何も書かずに**失敗する。失敗したら、表示された理由を下書きの側で直して、もう一度実行する。スクリプトを迂回して、編集ツールで生成先に直接書かない
5. 成功すると、下書きの置き場は消える。変更・削除したファイルの前の版は、OS の一時フォルダに残り、場所が表示される。Step 7 で利用者に伝える

下書きを書く段階では、通常のファイル編集としての確認が出ることがある（Claude Code が、編集を1つずつ確認するモードのとき）。その確認には「このセッションでは編集をすべて許可する」の選択肢があるので、最初の1回で済む。

#### 置き換える箇所

| 記号 | 入れるもの |
|---|---|
| `{{PROJECT_NAME}}` | プロジェクト定義の題名 |
| `{{PURPOSE_ONE_LINE}}` | 区分 A の目的を1文に縮めたもの |
| `{{DESIGN_DIRS}}` | 設計文書の置き場。通常は「`docs/` 以下」。区分 F に「設計文書の場所」があれば、それも含める（例:「`docs/` と `design/` 以下」）。`harness.json` の `pathSets.design` と一致させる |
| `{{TEST_PATHS}}` | テストの置き場を、人が読める形で（例:「`tests/`、`*.test.ts`、`*.spec.ts`」）。`harness.json` の `pathSets.tests` と一致させる |
| `{{EXTRA_MEMBER_ROWS}}` | 条件つきで足した役の行。セキュリティレビューがあれば「\| `security-reviewer` \| 秘密情報・個人情報・外部作用に関わる変更の、安全の観点からの確認 \| なし \|」、運用があれば「\| `operator` \| 承認つきの操作の実行（何を担当するか） \| なし \|」。無ければ空 |
| `{{SECURITY_REVIEW_STEP}}` | セキュリティレビューがあれば「変更が認証・秘密情報・個人情報・外部サービスの呼び出しに触れるなら、`security-reviewer` にも委任する。」。無ければ空 |
| `{{OPERATOR_NOTE}}` | 運用があれば「- 承認が要る操作（何か）が必要になったら、`operator` に委任する。`implementer` には実行できない。`implementer` が実装の途中で「承認待ち」を返してきたら（マイグレーションの生成など）、`operator` に実行してもらい、結果と、生成されたファイルの場所を添えて、`implementer` に続きを委任する」。無ければ、承認が要る操作があるときだけ、同じ文の `operator` を「あなた」に替えて書く（「- 承認が要る操作（何か）は、あなたが実行し、ユーザーの承認を得る。…」） |
| `{{COMMIT_STEP}}` | git で管理され、リモートがあれば「8. 検証を通った変更を、作業ブランチにコミットし、push する（テスト、コード、このタスクの文書をまとめて）。コミットと push をするのはあなたで、subagent にはさせない」。リモートが無ければ「…コミットする（…）。コミットするのはあなたで…」。git で管理されていなければ、行ごと削る |
| `{{BRANCH_RULE}}` | git で管理されていれば「- **作業は作業ブランチで行う**。依頼を受けたら最初に現在のブランチを確かめ、`main`・`master`・`develop` にいるなら、`git switch -c feature/<タスクID>` で作業ブランチを作ってから始める。保護ブランチへのコミット・マージ・push は、ハーネスが止める。保護ブランチへ取り込むのは、プルリクエスト（承認つき）で行う」。git で管理されていなければ、行ごと削る |
| `{{PROJECT_CONSTRAINTS}}`、`{{PROJECT_CONSTRAINTS_LIST}}` | プロジェクト定義の区分 A の「制約」の行。`CLAUDE.md` には読点でつないだ1行で、`task-contract` skill には箇条書きで。`none` なら、`CLAUDE.md` の行と、skill の節を、それぞれ丸ごと削る |
| `{{TOOLCHAIN_COMMANDS}}` | 区分 C から確定しているコマンド（依存の導入、テストの実行、検証コマンドがあればそれ）。推測のコマンドは入れない |
| `{{VERIFY_COMMAND}}`、`{{VERIFY_CWD}}` | `harness.json` の `verify` と同じ値。実行場所がルートなら「プロジェクトのルート」。検査の段階（5）を入れない場合は、これらを含む行ごと削る |
| `{{FORBIDDEN_FOR_IMPLEMENTER}}` | `commands` のうち、その役が実行できないもの全部（`deny` のすべてと、`roles` にその役が入っていない `ask`）を、`label` の箇条書きで。1つも無ければ、その節ごと削る |
| `{{APPROVAL_REQUIRED_ACTIONS}}`、`{{APPROVAL_REQUIRED_SUMMARY}}` | `commands` の `ask` を、`label` の箇条書き（SUMMARY は読点でつないだ1行）で。無ければ「なし」。SUMMARY は、同じ種類の操作をまとめて短くする（「本番デプロイ」「DB のマイグレーション」のように、`label` を種類の名前に丸める）。コマンドの一覧は Policy 表にあるので、ここに全部は並べない |
| `{{PROHIBITED_SUMMARY}}` | `commands` の `deny` と、秘密情報ファイルの読み取りを、1行で |
| `{{OPERATIONS_SUMMARY}}`、`{{OPERATIONS_LIST}}` | 運用役の担当。`ask` のうち、根拠が区分 D か E の行。共通の行は含めない |
| `{{SENSITIVE_SUMMARY}}`、`{{SENSITIVE_ITEMS}}` | セキュリティレビュー役が守るもの。区分 D の行を、SUMMARY は1行で、ITEMS は箇条書きでそのまま写す |
| `{{MAP_ROWS}}` | 区分 B・F から作る「知りたいこと → 場所」の行 |
| `{{COMMAND_ROWS}}` | `{{TOOLCHAIN_COMMANDS}}` と同じ内容を、表の行で |
| `{{AREA_*}}` | `assets/rules/area.template.md` の冒頭のコメントに従う |

### Step 6: 動くことを確かめる

完了には証拠が要る。これは、この Skill 自身の仕事にも当てはまる。生成したと言う前に、次を実行して確かめる。

1. JSON として読めること。`.claude/harness.json`、`.claude/settings.json`、（あれば）`.mcp.json`
2. hook のスクリプトが構文として正しいこと。`node --check .claude/hooks/write-boundary.mjs` など
3. 関門が、意図どおりに判定すること。標準入力に JSON を渡して hook を直接動かす。プロジェクトのルートで実行する。入力には必ず `"harness_probe":true` を付ける。付けないと、確認のための呼び出しが記録に残る。テストのファイル名は、このプロジェクトのテストの置き場に合わせて書き換える

```bash
# 主セッションがコードを書こうとする → deny が返る
echo '{"harness_probe":true,"tool_name":"Write","tool_input":{"file_path":"src/probe.txt"}}' | node .claude/hooks/write-boundary.mjs
# 主セッションが設計文書を書く → 何も出力されない（通過）
echo '{"harness_probe":true,"tool_name":"Write","tool_input":{"file_path":"docs/probe.md"}}' | node .claude/hooks/write-boundary.mjs
# コード実装役が設計文書を書こうとする → deny が返る
echo '{"harness_probe":true,"agent_id":"t","agent_type":"implementer","tool_name":"Edit","tool_input":{"file_path":"docs/project-definition.md"}}' | node .claude/hooks/write-boundary.mjs
# コード実装役がテストを書き換えようとする → deny が返る
echo '{"harness_probe":true,"agent_id":"t","agent_type":"implementer","tool_name":"Edit","tool_input":{"file_path":"tests/probe.test.ts"}}' | node .claude/hooks/write-boundary.mjs
# コード実装役が、シェル経由でテストを消そうとする → deny が返る
echo '{"harness_probe":true,"agent_id":"t","agent_type":"implementer","tool_name":"Bash","tool_input":{"command":"rm tests/probe.test.ts"}}' | node .claude/hooks/write-boundary.mjs
# テスト実装役がテストを書く → 何も出力されない（通過）
echo '{"harness_probe":true,"agent_id":"t","agent_type":"test-writer","tool_name":"Write","tool_input":{"file_path":"tests/probe.test.ts"}}' | node .claude/hooks/write-boundary.mjs
# テスト実装役が本体のコードを書こうとする → deny が返る
echo '{"harness_probe":true,"agent_id":"t","agent_type":"test-writer","tool_name":"Write","tool_input":{"file_path":"src/probe.ts"}}' | node .claude/hooks/write-boundary.mjs
```

   `commands` に規則を入れた場合は、その1つずつについて、主セッションで `ask`（または `deny`）、コード実装役で `deny` が返ることを、`"tool_name":"Bash"` と実際のコマンドの形で確かめる。直接の形だけでなく、間接実行（`pnpm exec ...`、`docker compose exec ...`）と、別の書き方（`git -C <場所> push`、`bash -c "..."`）でも確かめる。あわせて、似ているが無害なコマンド（`git log --grep push`、`git commit -m "... git push ..."`）が通過することも確かめる。1語だけの規則（`stripe`、`psql` など）があれば、その語を引数に持つだけのコマンド（`grep -rn stripe .`、`pnpm add stripe`）が、コード実装役で通過することも確かめる。
   役を分けた場合は、それぞれの役で、自分の場所に書けて、他の役の場所に書けないことも確かめる。
   git で管理されているプロジェクトでは、保護ブランチの判定も確かめる。hook は現在のブランチを git に聞くので、確認は実際のブランチで行う。`main` にいるなら `git commit -m x` と `git push` が deny、`git push origin feature/x` が通過、`git push origin main` が deny。作業ブランチにいるなら `git commit -m x` と `git push` が通過、コード実装役の `git push` が deny。`localOk` の規則があれば、`DATABASE_URL=postgresql://app@localhost/x pnpm exec prisma migrate reset` が通過し、`pnpm exec prisma migrate reset` が deny になることも確かめる
4. 生成した役が、`harness.json` の `roles`、`CLAUDE.md` の「メンバー」の表、根拠記録の「役の一覧」の3か所に、すべて載っていること
5. 利用者が読む文書（`CLAUDE.md`、根拠記録の本文）に、段階の番号や記号が出ていないこと
6. 部品一覧に載せたファイルが、すべて実在すること。載せていないファイルを生成していないこと。下書きの置き場（`docs/harness/.staging/`）が残っていないこと

期待と違う結果が出たら、原因を直してから報告する。確かめていない項目を、確かめたことにしない。
原因が `harness.json` の規則にあれば、規則を直す。hook のスクリプトの側にあって、規則では直せないときは、スクリプトを書き換えず、直ったことにもせず、Step 7 で未解決として利用者に伝える。

### Step 7: 結果を伝える

短く伝える。生成した全ファイルの中身を見せる必要はない。段階は呼び名で言う。

- 作ったメンバーと、それぞれが何をするか。作業の流れ（設計文書 → テスト → 実装 → レビュー → 検証）
- 入れた仕組みを、呼び名で
- 承認が要る操作と、禁止した操作の要点。**仕組みでは止められないもの**は必ず伝える
- 既存のファイルを変更・削除した場合は、前の版が残っている場所（スクリプトが表示した一時フォルダ）
- Claude Code を再起動すること。関門の hook は既に効いているが、新しく作った `.claude/agents/` の役は、再起動してから使えるようになる
- 再起動後の使い方。主セッションに設計や変更を相談すると、設計文書を更新したうえで、テスト、実装、レビュー、検証の順に委任する流れになること
- 「終わったと言う前に検査を通す」を入れた場合は、最初のタスクで検証コマンドを用意することになること。検証コマンドを実行する場所と、そこに用意すべきもの
- 次の段階は詳細設計であること。仕組みを足したり外したりしたくなったら、この Skill をもう一度実行すればよいこと

## 避けるパターン

| パターン | 避ける理由 |
|---|---|
| 利用者に「L3 まで」「レベル 5」のような番号や記号を見せる | 利用者には何のことか分からない。呼び名と、普段の使い方がどう変わるかで説明する |
| 役を減らす（コードとテストを1つの役に兼ねさせる、レビューや検証を省く） | 工程が欠けると、作る側と確かめる側の緊張が消える。メンバーは、どの構成でも一揃い作る |
| 構成要素ごとに Agent を作る（Web 担当、API 担当、DB 担当） | 構成要素の数は分ける理由にならない。分ける軸は工程。コード実装とテスト実装を分けるのは、ツールチェーンが違うときだけ |
| プロジェクトの基本情報をユーザーに聞き直す | 聞き取りは、定義を作る Skill（`project-design-opening`、`project-design-reboot`）の仕事。重複させると、片方を直したときにもう片方がずれる。足りなければ止まって案内する |
| 条件つきの部品を、条件を見ずに生成する | 防ぐ失敗が無い部品は、摩擦だけを足す。セキュリティレビュー、運用、`.mcp.json`、パス別のローカル指示は、条件を満たすときだけ |
| 完了の検査を、テスト実装役にも掛ける | テストが先の流れでは、テスト実装役が終わる時点でテストが落ちているのが正しい。掛けると、永久に終われない |
| 決まりを `CLAUDE.md` に書いて済ませる | 文脈は強制ではない。破られたら困る決まりは、hook と permissions に落とす |
| `CLAUDE.md` に設計や説明を書き込む | `CLAUDE.md` は地図であって説明書ではない。毎セッション読み込まれるので、長いほど守られなくなる。中身は `docs/` に置いて指す |
| 広い許可を入れる（`Bash(pnpm *)`、`Bash(git *)`、`Bash(docker *)`） | 公開や push まで通ってしまう。許可は下位コマンドに絞る |
| 役ごとのコマンド制限に `disallowedTools` を使う | `Bash(...)` の形で書くと、Bash ツールが丸ごと外れる。役ごとの制限は `harness.json` の `commands` で行う |
| 道具が未定の外部作用に、候補の CLI を並べて規則にする | 当たらない規則は網にならず、守られているという誤った印象を与える。「道具が未定」と表に書き、決まったら再実行する |
| Policy 表に、根拠を書けない行を足す | 同じ定義から、実行のたびに違う Policy が出る。共通の行を除き、根拠のある行だけを入れる |
| 止められない事故を、規則で止められるように見せる | 利用者が、自分で守るべき場所を見落とす。Policy 表に「仕組みでは止められない」と書く |
| 計画を見せずに書き込む | 権限と hook は、有効になった瞬間から振る舞いを変える。人が書いた設定を壊すおそれもある |
| 計画を承認してもらったあとに、`.claude/` へ編集ツールで1つずつ書く | 保護パスなので、ファイルごとに確認が出る。承認済みのことを十数回確認させると、利用者は読まずに承認するようになる。下書きを作り、スクリプトで一括して反映する |
| 承認された計画に無いファイルを、計画ファイル（`plan.json`）に足す | 一括で書き込めるのは、利用者が計画を承認したからである。計画に無いものを混ぜると、その承認の意味が無くなる |
| hook のスクリプトを、その場で書き換える | 動作を確かめた状態でなくなる。振る舞いは `harness.json` で変える |
| 確かめずに「生成しました」と報告する | 走らせていない検査を、通ったことにしない。Step 6 を実行する |
| 安全の下限を、選ばれた構成や利用者の希望で外す | 下限は選択の対象ではない。緩めたいなら、プロジェクト定義の区分 D を先に直す |
