# claude-skills

AI エージェントに開発を任せるための Skill 集。
曖昧なアイデアから、Agent が安全に開発を進められる状態までを、3つの Skill の連鎖で整える。

```text
曖昧なアイデア（新規）
  → project-design-opening    対話でプロジェクトの境界を定義する      docs/project-definition.md
既存のリポジトリ
  → project-design-reboot     走査と対話でプロジェクトの境界を定義する  docs/project-definition.md
      ↓（どちらから来ても、ここから先は同じ）
  → project-design-harness    Agent とハーネスを作る                  .claude/ 一式、docs/agent-architecture.md
  → 詳細設計の Skill           機能・要件・システム設計を詰める（構想中）  docs/system-design.md ほか
  → 開発
```

Agent に開発を任せるとき、失敗の多くはモデルの推論ではなく、モデルを取り巻く環境の不備から起きる。
どのファイルが大事か分からない、やってはいけない操作を止める仕組みがない、完了したと言うが確かめていない、といった失敗だ。
この環境（ハーネス）を設計するには、先に「何を扱うシステムなのか」「どこに境界があるのか」「外の世界にどんな作用を及ぼすのか」が決まっている必要がある。
3つの Skill は、その順番で材料を揃えていく。

## Skill の一覧

| Skill | 状態 | 概要 |
|---|---|---|
| [project-design-opening](project-design-opening/) | 初版（作者の実プロジェクトで試用する前の段階） | アイデアを対話で整理し、`docs/project-definition.md` を作る |
| [project-design-reboot](project-design-reboot/) | 初版（作者の実プロジェクトで試用する前の段階） | 既存のリポジトリを走査し、コードから分からないことだけを聞いて、同じ `docs/project-definition.md` を作る |
| [project-design-harness](project-design-harness/) | 初版（作者の実プロジェクトで試用する前の段階） | 定義を入力に、開発を担う Agent・権限・検証・状態管理を `.claude/` 以下に作る。Claude Code 専用 |
| 詳細設計の Skill | 構想中 | 上の2つを土台に、機能・要件・システム設計を詰める |

### project-design-opening

曖昧なソフトウェアのアイデアを、対話でプロジェクト定義に変換する。

- **決めること**: 目的とスコープ、システム境界、技術（言語・ランタイム・パッケージマネージャ・主要フレームワーク・DB 種別・デプロイ先種別）、リスク（外部作用・不可逆な操作・機微情報）、環境、リポジトリ構成、運用前提
- **決めないこと**: 詳細な機能一覧、画面仕様、API、DB スキーマ、実装手順。話に出た場合は要点だけ持ち越しメモに残す
- **対象**: 新規プロジェクト。種類は問わない（Web サービス、CLI、ライブラリ、デスクトップアプリ、モバイルアプリ、バッチ処理など）
- **対象外**: 既にコードがある既存プロジェクト。そちらは `project-design-reboot` を使う
- **動作する基盤**: 特定のエージェント基盤に依存しない。ファイルの読み書きができるエージェントであれば使える

固定の質問票を上から聞くのではなく、説明から読み取れることは聞かず、足りない項目だけを聞く。
推測で埋めた項目は、最後に一覧で見せて確認を取る。

成果物の例は [project-design-opening/assets/example.md](project-design-opening/assets/example.md)。

### project-design-reboot

既にコードがあるプロジェクトを走査し、`project-design-opening` が作るものと同じ書式のプロジェクト定義を作る。既存プロジェクトにハーネスを入れるときの入口。

- **先に読む**: 構成ファイル、依存の定義、CI とデプロイの設定、環境変数の雛形から、システム境界・技術・環境・リポジトリ構成を読み取る。lockfile を見れば分かることは聞かない
- **コードから分からないことだけ聞く**: やらないこと、制約、運用前提、そしてリスク。質問は多くて 3〜5 回
- **「見つからなかった」を「無い」と書かない**: 管理画面からの手動デプロイや、本番 DB への手作業の接続は、リポジトリに痕跡を残さない。リスクが無いと書くのは、聞いて確認が取れたときだけ
- **読み取ったことは、根拠つきで見せて確認を取る**: 使われていない依存や、移行の途中の古い設定を、事実として固定しない。コードとユーザーの答えが食い違ったら、根拠を見せて確かめる
- **秘密を読まない**: `.env` の中身は読まず、雛形のキーの名前だけを見る
- **評価も提案もしない**: 書くのは現状の定義。構成の良し悪しや、直し方には触れない
- **動作する基盤**: 特定のエージェント基盤に依存しない

既存プロジェクトでは道具の名前（Stripe、Prisma、Fly.io など）が具体的に分かるので、次の `project-design-harness` が作る承認と禁止の規則は、新規プロジェクトより具体的になる。
成果物の例は [project-design-reboot/assets/example.md](project-design-reboot/assets/example.md)。

### project-design-harness

プロジェクト定義を入力に、そのプロジェクトの開発を担う Agent とハーネスを、Claude Code 向けに生成する。

- **生成するもの**: `.claude/` 以下の subagent 定義・`settings.json`（permissions と hooks）・hook スクリプト・プロジェクト skill、ルートの `CLAUDE.md`、根拠記録 `docs/agent-architecture.md`
- **前提にする分業**: 設計書駆動で、テストが先。ユーザーと話す主セッションが設計の対話役を務めて設計文書を更新し、テスト実装役が契約からテストを書き、コード実装役がそれを通し、レビュー役と検証役が別の目で確かめる。この分担は指示ではなく hook で守らせる
- **必ず揃うメンバー**: 設計の対話（主セッション）／調査／テスト実装／コード実装／コードレビュー／検証。プロジェクト定義に秘密情報・個人情報・外部作用があればセキュリティレビュー、承認つきのコマンドがあれば運用を足す。分ける軸は開発の工程で、システムの構成要素（画面・API・DB）ではない。コードを書く役はテストを書き換えられず、テストを書く役は本体のコードを書き換えられない
- **必ず入る安全の決まり**: 外部作用は承認、不可逆・機微な操作は禁止、ハーネス自身への書き込みは承認。承認と禁止は役ごとに効く。コード実装役は、デプロイや push のような操作を、承認を求めることすらできない。`pnpm exec ...` や `git -C ... push`、`bash -c "..."` のような別の書き方でも、Bash でも PowerShell でも、同じ規則で判定する
- **選べるのは、仕組みをどこまで入れるか**: メンバーと安全の決まりの上に、累積で6段階。依頼を契約にしてから始める／プロジェクトの地図を持たせる／日常の操作で止まらないようにする（標準）／セッションをまたいで引き継ぐ／終わったと言う前に検査を通す／失敗を記録して、仕組みを育てる。どれを選んでも、メンバーと安全の決まりは同じ。利用者には、番号ではなく、この呼び名と「普段の使い方がどう変わるか」で説明する
- **確認は3回だけ**: 仕組みをどこまで入れるか、Policy 表（どの操作が承認／禁止／仕組みでは止められないか）、ファイルの計画。プロジェクトの基本情報は聞き直さない
- **前提**: Claude Code、Node.js（hook が Node.js のスクリプトのため）、`project-design-opening` か `project-design-reboot` で作ったプロジェクト定義。単体では動かない
- **対象外**: 機能・要件・システム設計の判断

既存の `.claude/` や `CLAUDE.md` があっても動く。書く前に「新規作成／変更／そのまま」の計画を見せ、人が書いたものは保つ。
仕組みで守れないこと（テストの中から本物の外部 API が呼ばれる、など）は、守れるかのように見せず、Policy 表に明記する。

## 導入

[skills CLI](https://github.com/vercel-labs/skills) を使う場合:

```bash
npx skills add polites-co-jp/claude-skills --skill project-design-opening
npx skills add polites-co-jp/claude-skills --skill project-design-reboot
npx skills add polites-co-jp/claude-skills --skill project-design-harness
```

手で入れる場合は、`project-design-opening/`、`project-design-reboot/`、`project-design-harness/` のフォルダを、使っているエージェントの Skill 用ディレクトリにコピーする
（Claude Code なら `~/.claude/skills/` か、プロジェクトの `.claude/skills/`）。

## 使い方

新しいプロジェクト用の空のフォルダでエージェントを開き、作りたいものを話す。

```text
小さな店舗向けの予約管理を Web で作りたい。カード決済もしたい。
```

既存のプロジェクトなら、そのリポジトリでエージェントを開いて、次のように頼む。

```text
このリポジトリのプロジェクト定義を作って。
```

どちらの場合も、対話が終わると `docs/project-definition.md` が作られる。続けて、同じフォルダで Claude Code に次のように頼む。

```text
このプロジェクトのハーネスを作って。
```

仕組みをどこまで入れるか、Policy 表、ファイルの計画の3つを確認すると、`.claude/` 以下が生成される。生成後は Claude Code を再起動する。
以後は、主セッションに設計や変更を相談すると、設計文書を更新したうえで、テスト、実装、レビュー、検証の順に、それぞれの役に委任する流れになる。

## 設計の記録

各 Skill の設計判断とその理由は [docs/decisions/](docs/decisions/) に残してある。

## 出典

ハーネスの考え方は、@LunarResearcher 氏の記事「Harness Engineering: The Complete Guide to Building AI Agents That Don't Fall Apart」
（<https://x.com/LunarResearcher/status/2096570562625655088>）に拠っている。この Skill 集は、記事の概念を自前の言葉で再定義して用いており、記事の本文は含まない。

## ライセンス

MIT
