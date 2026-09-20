# claude-skills

AI エージェントに開発を任せるための Skill 集。
曖昧なアイデアから、Agent が安全に開発を進められる状態までを、3つの Skill の連鎖で整える。

```text
曖昧なアイデア
  → project-design-opening    プロジェクトの境界を定義する            docs/project-definition.md
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
| [project-design-harness](project-design-harness/) | 初版（作者の実プロジェクトで試用する前の段階） | 定義を入力に、開発を担う Agent・権限・検証・状態管理を `.claude/` 以下に作る。Claude Code 専用 |
| 詳細設計の Skill | 構想中 | 上の2つを土台に、機能・要件・システム設計を詰める |

### project-design-opening

曖昧なソフトウェアのアイデアを、対話でプロジェクト定義に変換する。

- **決めること**: 目的とスコープ、システム境界、技術（言語・ランタイム・パッケージマネージャ・主要フレームワーク・DB 種別・デプロイ先種別）、リスク（外部作用・不可逆な操作・機微情報）、環境、リポジトリ構成、運用前提
- **決めないこと**: 詳細な機能一覧、画面仕様、API、DB スキーマ、実装手順。話に出た場合は要点だけ持ち越しメモに残す
- **対象**: 新規プロジェクト。種類は問わない（Web サービス、CLI、ライブラリ、デスクトップアプリ、モバイルアプリ、バッチ処理など）
- **対象外**: 既にコードがある既存プロジェクト。後付けでの導入には対応していない
- **動作する基盤**: 特定のエージェント基盤に依存しない。ファイルの読み書きができるエージェントであれば使える

固定の質問票を上から聞くのではなく、説明から読み取れることは聞かず、足りない項目だけを聞く。
推測で埋めた項目は、最後に一覧で見せて確認を取る。

成果物の例は [project-design-opening/assets/example.md](project-design-opening/assets/example.md)。

### project-design-harness

プロジェクト定義を入力に、そのプロジェクトの開発を担う Agent とハーネスを、Claude Code 向けに生成する。

- **生成するもの**: `.claude/` 以下の subagent 定義・`settings.json`（permissions と hooks）・hook スクリプト・プロジェクト skill、ルートの `CLAUDE.md`、根拠記録 `docs/agent-architecture.md`
- **前提にする分業**: 設計書駆動。ユーザーと話す主セッションが設計の対話役を務めて `docs/` を更新し、コードは実装役の subagent だけが書く。この分担は指示ではなく hook で守らせる
- **必ず入る土台**: 役（主セッション・実装役・調査役）、役ごとの書き込み境界、安全の下限（外部作用は承認、不可逆・機微な操作は禁止、ハーネス自身への書き込みは承認）。承認と禁止は役ごとに効く。実装役は、デプロイや push のような操作を、承認を求めることすらできない。`pnpm exec ...` や `git -C ... push`、`bash -c "..."` のような別の書き方でも、Bash でも PowerShell でも、同じ規則で判定する
- **選べる重さ**: 土台の上に6段階。L1 タスク契約／L2 地図とコマンド／L3 許可リストと道具の絞り込み／L4 永続状態／L5 完了ゲート・検証役・変更レシート／L6 失敗の分類・トレース・振り返り。推奨は L3
- **確認は3回だけ**: レベル、Policy 表（どの操作が自動／承認／禁止か）、ファイルの計画。プロジェクトの基本情報は聞き直さない
- **前提**: Claude Code、Node.js（hook が Node.js のスクリプトのため）、`project-design-opening` で作ったプロジェクト定義。単体では動かない
- **対象外**: 既にコードがある既存プロジェクトへの後付け。機能・要件・システム設計の判断

既存の `.claude/` や `CLAUDE.md` があっても動く。書く前に「新規作成／変更／そのまま」の計画を見せ、人が書いたものは保つ。
仕組みで守れないこと（テストの中から本物の外部 API が呼ばれる、など）は、守れるかのように見せず、Policy 表に明記する。

## 導入

[skills CLI](https://github.com/vercel-labs/skills) を使う場合:

```bash
npx skills add polites-co-jp/claude-skills --skill project-design-opening
npx skills add polites-co-jp/claude-skills --skill project-design-harness
```

手で入れる場合は、`project-design-opening/` と `project-design-harness/` のフォルダを、使っているエージェントの Skill 用ディレクトリにコピーする
（Claude Code なら `~/.claude/skills/` か、プロジェクトの `.claude/skills/`）。

## 使い方

新しいプロジェクト用の空のフォルダでエージェントを開き、作りたいものを話す。

```text
小さな店舗向けの予約管理を Web で作りたい。カード決済もしたい。
```

対話が終わると `docs/project-definition.md` が作られる。続けて、同じフォルダで Claude Code に次のように頼む。

```text
このプロジェクトのハーネスを作って。
```

レベルと Policy 表とファイルの計画を確認すると、`.claude/` 以下が生成される。生成後は Claude Code を再起動する。
以後は、主セッションに設計や変更を相談すると、設計文書を更新したうえで実装役に委任する流れになる。

## 設計の記録

各 Skill の設計判断とその理由は [docs/decisions/](docs/decisions/) に残してある。

## 出典

ハーネスの考え方は、@LunarResearcher 氏の記事「Harness Engineering: The Complete Guide to Building AI Agents That Don't Fall Apart」
（<https://x.com/LunarResearcher/status/2096570562625655088>）に拠っている。この Skill 集は、記事の概念を自前の言葉で再定義して用いており、記事の本文は含まない。

## ライセンス

MIT
