# スキル共通の公開仕様 裁定記録

> 追記（2026-09-20）: `project-design-reboot` にも、C1・C3・C4・C5 をそのまま適用する。C2 については、reboot は Skill 1 と同じく基盤中立とする（[project-design-reboot.md](project-design-reboot.md) の R6）。

`project-design-opening`（Skill 1）・`project-design-harness`（Skill 2）・Skill 3 に共通する公開仕様の判断を、確定した順に記録する。
個別スキルの裁定は [project-design-opening.md](project-design-opening.md) と [project-design-harness.md](project-design-harness.md)。

## 裁定

### C1. スキル本文は日本語、成果物は利用者の言語（2026-09-20）

- `SKILL.md`・`references/`・README は日本語で書く。作者の既存スキルと揃い、作者自身が読んで直せる。
- スキルが生成する成果物（`project-definition.md`、`agent-architecture.md`、`CLAUDE.md`、Agent 定義など）は、
  利用者が会話している言語に合わせる。スキル本文でそう指示する。
- 後続スキルが機械的に読む部分（入力契約の区分 A〜H、項目の状態のラベルなど）は、言語によらず固定のキーにする。
- 退けた案: すべて英語にする案／本文は日本語で README だけ日英併記にする案。
- 提示済みの代償: 日本語を読めない人はスキルの中身を理解・改変しにくい。

### C2. Skill 1 は基盤中立、Skill 2 は Claude Code 専用（2026-09-20）

- Skill 1 は特定基盤のツール名に依存しない書き方にする
  （質問は「選択式の質問ツールがあればそれを使い、無ければ平文で聞く」）。
- `project-definition.md` は基盤に依存しない。将来、他基盤向けの Skill 2 相当を作る余地を残す。
- Skill 2 は `.claude/` を生成するので Claude Code 専用。README に明記する。
- 退けた案: Skill 1 も Claude Code の機能を前提に作り込む案。
- 帰結: Skill 1 の Mode 2（過去の採用実績）の取得方法も、特定基盤の記憶機能を前提にできない。

### C3. 公開前の品質確認は、作者の実プロジェクトで試して直す（2026-09-20）

- 作者自身の実プロジェクトで 1〜2 回使い、気づいた点を直してから公開する。
- 評価の仕組み（hook の単体テスト、skill-creator によるシナリオ評価）は作らない。
- 退けた案: hook の単体テスト＋シナリオ評価（提示時の推奨）／hook の単体テストだけ。
- 提示済みの代償: 確かめたことになるのは試したプロジェクトの構成だけ。スキルを直したときに、以前動いていた場面が
  壊れても気づけない。hook の判定ミスは安全側の事故に直結する。
- 帰結: 実装計画に評価基盤の構築は含めない。試用するプロジェクトと、そこで何を見るかは実装時に決める。

### C4. ライセンスは MIT（2026-09-20）

- リポジトリ直下に MIT の `LICENSE` を置く。
- 著作権者の名義は `polites-co-jp`（GitHub の組織名）。2026-09-20 に作者へ確認して `LICENSE` を作成した。
- 元記事（Harness Engineering）の概念は自前の言葉で再定義し、出典として記事を明記する（Skill 2 の H7）。記事本文は同梱しない。
- 退けた案: Apache-2.0／公開直前まで決めない案。

### C5. 配布は `npx skills` と手動コピー（2026-09-20）

- README に2通りの導入方法を書く。`npx skills add polites-co-jp/claude-skills` でスキルを選んで導入する方法と、
  スキルのフォルダをスキル用ディレクトリへコピーする方法。
- 作者自身の環境（`~/.agents/skills` と `.skill-lock.json`）がこの仕組みなので、自分で導入して確かめられる。
  複数の基盤へ配れる点で、Skill 1 の基盤中立（C2）とも合う。
- リポジトリの構成は Skill 1 の D1 のまま（直下にスキルのフォルダを並べ、それぞれの直下に `SKILL.md`）。
- 確認済み（2026-09-20）: `npx skills add . --list` をリポジトリ直下で実行し、直下に置いた `project-design-opening` が
  スキルとして認識され、フロントマターの description が読めることを確かめた。D1 の構成のままでよい。
  リモート（`polites-co-jp/claude-skills`）を指定した導入は、プッシュ後に作者の環境で確かめる。
- 退けた案: Claude Code のプラグインとしても配る案（D1 の構成の見直しが要り、保守する配布経路が増える）／手動コピーだけの案。

### C6. 公開後は、hook の最小限の回帰テストをリポジトリに持つ（C3 の一部改定, 2026-09-23）

「このスキルを誰でも使えるようにするには」という作者の問いに対する回答の一部として、AskUserQuestion で確認した。

- **改定**: C3「評価の仕組みは作らない」は、非公開・単独開発を前提にした判断だった。リポジトリは既に公開されており
  （2026-09-23 時点で GitHub `polites-co-jp/claude-skills` は public、Issues 有効）、他者からの Issue・PR を受ける前提に立つなら、
  誰かの変更が安全側の判定（保護ブランチの可否、コマンドの承認・禁止、書き込み境界）を壊しても、テストが無ければ誰も気づけない。
  そこで、**`project-design-harness` の hook とインストーラだけ**、最小限の回帰テストをリポジトリに持つ。
- C3 の他の部分（`project-design-opening`・`project-design-reboot` の対話の振る舞いは、作者の実プロジェクトでの試用で確かめる。
  skill-creator によるシナリオ評価は作らない）は変えない。対話には決定的な入出力が無く、機械的なテストに向かない。
- 実現: フレームワークを使わない素の Node.js スクリプト。
  - `tests/check-repo.mjs`（リポジトリ全体）: JSON テンプレートが読めること、Markdown の相対リンクが解決すること、
    `{{PLACEHOLDER}}` が `SKILL.md` に説明されていること、利用者向けの文面に段階の番号が残っていないこと。
  - `project-design-harness/tests/hook-scenarios.mjs`: `write-boundary.mjs` と `completion-gate.mjs` を、実行のたびに一時ディレクトリへ
    作る実在の git リポジトリを使って、約215の場面で確認する（既存の試験生成で積み上げた場面をそのまま移した）。
  - `project-design-harness/tests/installer.mjs`: `scripts/harness-install.mjs` を約25の場面で確認する。
  - `.github/workflows/ci.yml`: push と pull request のたびに、上の3つと hook スクリプトの構文チェック、
    `npx skills add . --list` によるスキル検出を自動実行する。
- 退けた案: skill-creator によるシナリオ評価も足す案（対話の振る舞いは決定的でなく、機械的な期待値を書けない。C3 のまま実プロジェクトでの試用に委ねる）／
  C3 のまま、作者が手元で確認する運用を続ける案（今回はこちらではなく、テストを足す方を選んだ）。
- 確認できていないこと: 実際に外部からの Issue・PR が来た場合に、この CI がどこまで有効に働くかは未検証。

### C1 の再確認（英語話者への公開範囲, 2026-09-23）

「誰でも使えるようにするには」の一環で、スキル本文（`SKILL.md`・`references/`）の英語版を並行提供するかを AskUserQuestion で確認した。
**当面は日本語のみのまま**、C1 を変えない、という回答だった。生成される成果物は引き続き利用者の言語に合わせるが、
スキルの中身を読んで監査・改変できるのは、当面は日本語話者に限られる。英語話者からの要望が実際に来てから、翻訳の要否を判断する。
