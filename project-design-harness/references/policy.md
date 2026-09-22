# Policy: 承認と禁止の導き方

プロジェクト定義から、「自動でやってよい操作／人の承認が要る操作／禁止する操作」を導く手順。
ここで導く**安全の下限**は、利用者が仕組みをどこまで入れると選んでも、必ず生成する。

同じプロジェクト定義からは、同じ Policy が出るようにする。この文書の規則で決まらないことを、その場の推測で足さない。

## 目次

- [4つの階級](#4つの階級)
- [2つの層: hook と permissions](#2つの層-hook-と-permissions)
- [導く手順](#導く手順)
- [道具が決まっていないとき](#道具が決まっていないとき)
- [操作とコマンドの対応](#操作とコマンドの対応)
- [どのプロジェクトにも入れる行](#どのプロジェクトにも入れる行)
- [日常の操作の許可リスト](#日常の操作の許可リスト)
- [permissions の書き方（確認済みの仕様）](#permissions-の書き方確認済みの仕様)
- [仕組みでは止められないもの](#仕組みでは止められないもの)
- [Policy 表の見せ方](#policy-表の見せ方)

## 4つの階級

結果が重いほど、関門を固くする。

| 階級 | 例 | 扱い |
|---|---|---|
| 読むだけ | ファイルを読む、検索する、状態を照会する | 自動 |
| 可逆な変更 | 作業場所の編集、テストやビルドの実行、ローカルのコンテナ操作 | 自動 |
| 外部作用 | メッセージ送信、デプロイ、課金、外部 API への書き込み、リモートへの push | 人の承認（`ask`） |
| 不可逆・機微 | 本番データの削除、認証情報の失効、公開済みの版の取り下げ、履歴の書き換え | 禁止（`deny`）。開発で正当に必要になるものだけ、承認（`ask`） |

「不可逆・機微」を `deny` にするか `ask` にするかは、**開発の中で正当に必要になる場面があるか**で決める。

- 本番 DB のマイグレーションは、リリースのたびに必要になる → `ask`
- DB の初期化（全データの削除）は、本番に対しては決して要らず、コマンドの見た目では対象の環境を区別できない → `deny`
- パッケージの公開は、リリースのたびに必要になる → `ask`。公開済みの版の取り下げは、通常は要らない → `deny`

迷ったら `deny` にする。後から緩めるのは1行の変更で、利用者の承認を経てできる。緩い設定で起きた事故は戻せない。

## 2つの層: hook と permissions

コマンドの制限は、2つの層に書く。**主役は hook** で、permissions は2枚目の網である。

| | hook（`.claude/harness.json` の `commands`） | permissions（`.claude/settings.json`） |
|---|---|---|
| 役ごとの違い | 付けられる。承認を求められる役を限定できる | 付けられない。セッション全体に効く |
| 照合 | 1つの単純なコマンドの中の、どこに現れても一致する（1語だけの規則は、実行されるプログラムの位置だけ）。`pnpm exec prisma migrate reset` も `docker compose exec db psql` も捕まえる | コマンド文字列の先頭からの照合。`pnpm exec ...` のような間接実行には一致しない |
| シェル | Bash と PowerShell を同じ規則で見る | `Bash(...)` と `PowerShell(...)` は別の規則 |
| 利用者からの見え方 | `harness.json` を読まないと分からない | `/permissions` で一覧できる |

だから、`deny` と `ask` のコマンドは**両方に書く**。役ごとの制限（実装役には承認すら求めさせない）は hook にしか書けない。

### hook の規則から permissions の規則への直し方

2枚目の網は、**直接の形（コマンドが行頭に来る形）だけ**を受け持つ。間接実行や別の書き方は hook が受け持つので、permissions の側で追いかけない。次の規則で機械的に直す。

| hook の `match` | permissions の規則 |
|---|---|
| `git push * --force*` のような git の規則 | 下の行のとおり |
| `localOk` を付けた規則 | **permissions には書かない**。`deny`・`ask` の規則は、先頭の環境変数の代入（`DATABASE_URL=...`）を読み飛ばして一致するので、ローカルを指した形まで止めてしまう。この規則は hook だけで受け持つ |
| 保護ブランチ（hook の `git.protectedBranches`） | 保護ブランチ1つにつき、`Bash(git push * <名前>)` と `Bash(git push * *:<名前>)` を `deny` に。行頭からの照合なので、`git push` だけの形（現在のブランチへの push）は hook しか判定できない |
| `stripe`（1語） | `Bash(stripe *)` |
| `git push * --force*`（途中に単独の `*`。最後の語が `*` で終わる） | `*` を外した形と残した形の2本。`Bash(git push --force*)` と `Bash(git push * --force*)` |
| `prisma db push * --force-reset`（途中に単独の `*`。最後の語が `*` で終わらない） | 同じく2本で、末尾に ` *` を足す。`Bash(prisma db push --force-reset *)` と `Bash(prisma db push * --force-reset *)` |
| 区分 E の開発環境が Windows | 上と同じものを `PowerShell(...)` の形でも書く |

`pnpm exec prisma migrate reset` のような形を permissions に足さない。パッケージマネージャごと、呼び出し方ごとに増えていき、それでも網羅できない。そこは hook の仕事である。

### hook の規則

```json
"commands": [
  { "match": "git push * --force*", "decision": "deny", "label": "強制 push" },
  { "match": "git push",             "decision": "ask",  "label": "リモートへの push" },
  { "match": "prisma migrate reset", "decision": "deny", "label": "DB の初期化" }
]
```

- `match` は、空白で区切った語の並び。**2語以上の規則**は、1つの単純なコマンド（`&&` や `|` で区切った1片）の中の**どの位置からでも**、この順で**隣り合って**現れれば一致する。だから `pnpm exec prisma migrate reset` も `docker compose exec web prisma migrate deploy` も捕まえ、`git log --grep push` は `git push` に一致しない
- **1語だけの規則**（`stripe`、`psql`、`vercel` など）は、その語が**実行されるプログラムの位置**にあるときだけ一致する。どの位置でも一致させると、`grep -rn stripe app`、`pnpm add stripe`、`mkdir app/api/stripe` まで止めてしまうからだ。プログラムの位置とは、行頭（`FOO=bar` の代入の後を含む）、`sudo`・`env`・`npx`・`xargs` などの後、`pnpm exec`・`pnpm dlx`・`uv run`・`bundle exec` などの後、`pnpm stripe`・`yarn stripe` の形の2語目、`docker compose exec`・`docker run`・`kubectl exec`・`ssh` に渡された部分、PowerShell の `&` と `Start-Process` の後。ここに無い包み方で呼ばれた1語の規則は、すり抜ける
- 先頭の語はプログラム名として照合する（`./node_modules/.bin/prisma`、`/usr/bin/git`、`prisma.exe` も一致）。プログラム名の直後の全体オプションは読み飛ばす（`git -C apps/web push`、`git -c k=v push`、`git --no-pager push` は `git push` に一致）
- 単独の `*` は、0個以上の語。`git push * --force*` は `git push --force` にも `git push origin main --force` にも一致する
- 語の中の `*` は、任意の文字列。`--force*` は `--force` にも `--force-with-lease=main` にも一致し、`-f*` は `-f` にも `-fu` にも一致する
- シェルに文字列で渡されたコマンド（`bash -c "..."`、`powershell -Command "..."`）、`eval`、`Invoke-Expression`、引用符の中のコマンド置換（`"$(...)"`）の中身も、同じように調べる
- `deny` が一致すれば、`ask` より優先する。`deny` はすべての役で拒否
- `ask` は、`roles` に挙げた役だけが承認を求められる。省略時は `["main", "operator"]`。それ以外の役（実装役など）は拒否され、「自分で実行せず、必要であることを報告せよ」と返る
- `label` は、利用者と Agent に見せる操作の名前。利用者の言語で書く

## 導く手順

1. **プロジェクト定義に名前が出ている道具を洗い出す**。区分 B（外部とのやりとり、配布・実行場所）、C（技術）、E（環境）、および H（持ち越し）に書かれた、具体的な製品名・サービス名・CLI。ここに無い道具の規則は作らない
2. **区分 D の「外部作用」を1行ずつ取り上げる**。手順 1 の道具の中から、それを実行しうるコマンドを下の対応表で特定し、`ask` にする。特定できなければ「道具が決まっていないとき」に従う
3. **区分 D の「不可逆・機微な操作」を1行ずつ取り上げる**。同じくコマンドを特定し、上の基準で `deny` か `ask` かを決める
3a. **区分 D の行に、コマンドそのものが書かれていれば**（既存プロジェクトの定義に多い。「本番 DB に `psql` でつなぐ」「`prisma migrate dev`」など）、下の対応表に無くても、そのコマンドを規則にする。扱いは、その行の項目（外部作用なら `ask`、不可逆・機微なら上の基準）で決める。**危険なコマンドを包んだ scripts の名前が書かれていれば**（既存プロジェクトの定義に多い。「`pnpm db:reset`（中身は `prisma migrate reset --force`）」など）、中のコマンドに加えて、scripts の呼び出しも同じ扱いの規則にする。hook の `match` は `<パッケージマネージャ> * <scripts の名前>` の形で書く（`pnpm * db:reset`）。これ1本で、`pnpm db:reset` も `pnpm run db:reset` も `pnpm --dir apps/web run db:reset` も捕まえる。包まれた形は、コマンドの文字列から中身が見えないので、名前で止めるしかない
3b. **区分 D の「秘密情報・個人情報」に秘密情報があれば**、手順 1 の道具のうち、秘密情報を管理するコマンドを持つものを `ask` にする（対応表の「秘密情報の管理」）
4. **git を見る**。プロジェクトが git で管理されていれば（`.git` がある）、**保護ブランチの規則**を入れる。`main`・`master`・`develop` へのコミット・マージ・rebase・push は `deny`（hook の `git.protectedBranches`。雛形のまま）。保護ブランチへ入れるのは、プルリクエストである。これは、作業のまとまりごとにコミットする、という運用と対になっている（[agents.md](agents.md)「流れの外にある仕事の持ち主」）。
   リモートのホスティングがあれば（区分 E が `none` でも `deferred` でもなければ）、さらに次を入れる。強制 push、リモートのブランチの削除のうち保護ブランチのもの → `deny`。作業ブランチへの push → 日常の操作（承認なし。段階 3 以上で `allow`）。タグの push（リリースを起動しうる）、保護ブランチ以外のリモートのブランチの削除、ローカルのブランチではないものの push → `ask`（hook が判定する。規則は書かない）。プルリクエストの作成とマージ、CI の手動実行（下の対応表）→ `ask`。マージは、push と同じ結果（既定のブランチの更新、それに連なる自動デプロイ）を起こす。CI の定義ファイル（下の対応表）の編集 → `ask`。
   push できる役は、主セッションと運用役だけ（hook の `git.pushRoles`。雛形のまま）。コード実装役やテスト実装役の push は、確認なしで拒否される
5. **区分 E の実行環境の段階を見る**。本番か staging があり、区分 C に DB 種別があれば、その DB のクライアントコマンドを `ask` にし、`localOk` を付ける。コマンドの見た目では接続先を区別できないので、`deny` にはしない。
   **`localOk`**: DB を対象にする規則（この行と、対応表の「DB のマイグレーション」「DB の初期化」「DB への直接接続」、手順 3a の DB の scripts）には、`"localOk": true` を付ける。接続先がこの機械だとコマンドの文字列から分かる形（`DATABASE_URL=postgresql://...@localhost/... prisma migrate reset`、`psql -h 127.0.0.1`、`docker compose exec db psql`、SQLite のファイル）は、テスト DB への操作として、承認なしで通す。接続先が見えない形（`.env` 任せの `prisma migrate reset`）と、外を指す形は、規則どおり。判定の詳細は [harness-config.md](harness-config.md) の `localOk`。
   区分 E で開発用の DB をコンテナで動かしているなら、compose のサービス名（`docker-compose.yml` / `compose.yaml` の `services:` の名前）を `harness.json` の `localHosts` に入れる。コンテナの中から `-h db` で指す形を、ローカルと判定するため
6. **「どのプロジェクトにも入れる行」を足す**

区分 D の3項目がすべて `none` のプロジェクトでは、手順 2〜3 の結果は空になる。それで正しい。手順 4〜6 は、その場合も行う。

各行には、根拠にしたプロジェクト定義の行（区分と項目）を必ず付ける。根拠を書けない行は、手順 6 の共通の行を除いて、入れてはいけない。

階級は、次のように決める。手順 2 の行は「外部作用」。手順 3・3b の行は「不可逆・機微」。手順 4 の保護ブランチへの変更、強制 push、リモートのブランチの削除は「不可逆・機微」。作業ブランチへの push は「可逆な変更」（戻せる。本番には届かない）。プルリクエストの作成とマージ、タグの push、CI の手動実行、CI の定義ファイルの編集は「外部作用」。手順 5 の DB への直接接続は「不可逆・機微」（本番のデータに触れうる）。

## 道具が決まっていないとき

プロジェクト定義は、道具を種別でしか書いていないことがある（「コンテナを動かせるクラウド」「決済サービス」）。

- **候補を並べて規則にしない**。デプロイ先が未定だからといって、主要なクラウドの CLI を全部 `ask` に入れない。当たらない規則は網にならず、利用者に「守られている」という誤った印象を与える
- その外部作用は、Policy 表に**「道具が未定のため、仕組みでは止められない」**として載せる。守り方は「決まったらプロジェクト定義を更新し、この Skill を再実行する。それまでは人が実行する」
- 区分 H に持ち越された道具（利用者が「ORM は Prisma を使いたい」と述べた、など）は、**規則に含める**。利用者が使うつもりだと述べた道具であり、含めて困ることは無い。Policy 表の根拠には「H の持ち越しに基づく（未確定）」と書く
- 名前は出ているが、コマンドラインの道具を持たないサービス（メッセージ配信の Web API など）は、規則にできない。それが区分 D の外部作用に当たるなら「仕組みでは止められない」の行として載せ、当たらないなら何もしない

## 操作とコマンドの対応

プロジェクト定義に名前が出ている道具についてだけ使う。ここに無い道具は、その道具の公式のコマンド体系から同じ考え方で導く。

| 操作 | 道具 → hook の `match` | 扱い |
|---|---|---|
| デプロイ | Vercel → `vercel`／Fly.io → `fly deploy`, `flyctl deploy`／Cloudflare → `wrangler deploy`, `wrangler publish`／Firebase → `firebase deploy`／Netlify → `netlify deploy`／Google Cloud → `gcloud`／AWS → `aws`, `sam deploy`, `cdk deploy`／Azure → `az`／Kubernetes → `kubectl apply`, `kubectl delete`, `helm upgrade`, `helm install` | `ask` |
| 基盤の変更 | Terraform → `terraform apply`／Pulumi → `pulumi up` | `ask` |
| 基盤の破棄 | Terraform → `terraform destroy`／Pulumi → `pulumi destroy` | `deny` |
| コンテナイメージの公開 | 区分 C のデプロイ先種別がコンテナを動かす基盤で（「コンテナを動かせるクラウド」を含む）、定義に Docker が出ている → `docker push`, `docker image push`, `docker compose push`, `docker buildx build * --push` | `ask` |
| パッケージの公開 | npm 系 → `npm publish`, `pnpm publish`, `yarn publish`／Cargo → `cargo publish`／Python → `twine upload`, `uv publish`／Ruby → `gem push` | `ask` |
| 公開済みの版の取り下げ | `npm unpublish`／`cargo yank` | `deny` |
| リリースの作成 | 区分 D にリリースや公開が外部作用として書かれていて、ホスティングが GitHub → `gh release create` | `ask` |
| プルリクエストとCI（手順 4） | GitHub → `gh pr create`, `gh pr merge`, `gh workflow run`／GitLab → `glab mr create`, `glab mr merge`, `glab ci run` | `ask` |
| DB のマイグレーション（本番を含みうる） | Prisma → `prisma migrate deploy`, `prisma migrate dev`／Drizzle → `drizzle-kit migrate`, `drizzle-kit push`／Alembic → `alembic upgrade`／Rails → `rails db:migrate`／Knex → `knex migrate:latest`／Flyway → `flyway migrate` | `ask`（`localOk`） |
| DB の初期化 | Prisma → `prisma migrate reset`, `prisma db push * --force-reset`／Rails → `rails db:drop`, `rails db:reset`／PostgreSQL → `dropdb` | `deny`（`localOk`。テスト DB の初期化は、接続先を明示した形で通る） |
| DB への直接接続（手順 5） | PostgreSQL → `psql`／MySQL → `mysql`／MongoDB → `mongosh`／Redis → `redis-cli` | `ask`（`localOk`） |
| 決済サービスの操作 | Stripe → `stripe` | `ask` |
| 秘密情報の管理（手順 3b） | GitHub → `gh secret`／Vercel → `vercel env`／Fly.io → `fly secrets`, `flyctl secrets` | `ask` |

CI の定義ファイル（手順 4）。編集を permissions の `ask` にする。

| ホスティング | 規則 |
|---|---|
| GitHub | `Edit(/.github/workflows/**)` |
| GitLab | `Edit(/.gitlab-ci.yml)` |
| その他 | CI の製品が定義に書かれていれば、その定義ファイルのパス。書かれていなければ作らない |

外部サービスを MCP サーバー経由で使う場合は、そのツール名を permissions に書く（`mcp__<サーバー名>__<ツール名>`）。書き込み系のツールは `ask`、破壊的なツールは `deny`。

## どのプロジェクトにも入れる行

プロジェクト定義に根拠行を持たない、共通の行。Policy 表の根拠には「共通」と書く。

| 操作 | 規則 | 扱い | 理由 |
|---|---|---|---|
| 秘密情報ファイルを読む | permissions: `Read(.env*)`、`Read(!.env.example)`、`Read(!.env.sample)`、`Read(!.env.template)`、`Read(**/secrets/**)` | `deny` | 区分 D の秘密情報が `none` でも入れる。秘密情報は後から増える。`Read` の `deny` は、同じパスへの Edit と Write も止める。雛形のファイルは `!` で除外する |
| 未コミットの作業を消す | hook: `git clean`、`git reset * --hard`。`roles` には、主セッション・運用役に加えて、コード実装役とテスト実装役をすべて入れる | `ask` | 取り消せないので人に確かめる。ただし失敗した試みを捨てて戻すのは、実装役の正当な回復手段でもある |
| 履歴の書き換え（ホスティングがあるとき） | hook: `git push * --force*`、`git push * -f*` | `deny` | 他の人の作業と、戻すための履歴を壊す。根拠には「共通（E: ホスティングあり）」と書く |
| 保護ブランチへの変更（git で管理されているとき） | hook: `git.protectedBranches`（`main`、`master`、`develop`） | `deny` | 作業は作業ブランチで行い、保護ブランチへはプルリクエストで入れる。根拠には「共通（git）」と書く |
| ハーネス自身の変更 | hook の保護パス | 主セッションは承認、subagent は拒否 | Agent が自分の権限を黙って広げない。この Skill の再実行だけは、ファイルの計画の承認をもって承認とし、同梱のスクリプトで一括して書き込む（[merge.md](merge.md) の「書き込むとき」）。そのスクリプトを subagent が実行することは、hook が拒否する |
| 役ごとの書き込み境界 | hook の `roles` | 範囲外は拒否 | [agents.md](agents.md) |

**入れないもの**。`rm -rf` 全般と、`curl`・`wget`。ビルド成果物の掃除やローカルの動作確認で日常的に使うので、承認にすると流れが止まり、利用者は考えずに承認する癖が付く。考えずに承認される関門は、無いより悪い。
作業場所の中の削除は、git で戻せる可逆な変更として扱う。書き込み境界 hook が、役の範囲外の削除を止める。

## 日常の操作の許可リスト

「日常の操作で止まらないようにする」（段階 3）以上では、日常の可逆な操作を permissions の `allow` に入れて、承認待ちで流れが止まらないようにする。区分 C のパッケージマネージャと、区分 E のコンテナ利用と git から導く。
次の種類の操作は、承認を求めない。設計文書への書き込み、検索、コンテナの操作、画面テスト（E2E）の実行、テスト DB への操作、作業ブランチへのコミットと push。

| 区分 C・E | `allow` に入れる例 |
|---|---|
| pnpm / npm / yarn | `Bash(pnpm install *)`、`Bash(pnpm run *)`、`Bash(pnpm test *)`、`Bash(pnpm exec *)`（npm・yarn も同じ形） |
| uv / pip | `Bash(uv sync *)`、`Bash(uv run *)`、`Bash(pytest *)` |
| Cargo | `Bash(cargo build *)`、`Bash(cargo test *)`、`Bash(cargo check *)`、`Bash(cargo clippy *)`、`Bash(cargo fmt *)` |
| Go | `Bash(go build *)`、`Bash(go test *)`、`Bash(go vet *)`、`Bash(go mod *)` |
| CMake | `Bash(cmake *)`、`Bash(ctest *)` |
| 画面テスト（E2E）の道具が区分 C にある | Playwright → `Bash(npx playwright *)`、`Bash(playwright *)`／Cypress → `Bash(npx cypress *)`、`Bash(cypress *)`（パッケージマネージャ経由の形は上の行で通る） |
| コンテナを開発に使う | `Bash(docker compose *)`、`Bash(docker build *)`、`Bash(docker run *)`、`Bash(docker exec *)`、`Bash(docker ps *)`、`Bash(docker logs *)`、`Bash(docker stop *)`、`Bash(docker start *)`、`Bash(docker restart *)`、`Bash(docker rm *)`、`Bash(docker rmi *)`、`Bash(docker images *)`、`Bash(docker volume *)`、`Bash(docker network *)`。`docker compose push` は `ask` の規則が勝つ。`docker login`、`docker context`、`docker push` は入れない |
| git（git で管理されているとき） | `Bash(git status *)`、`Bash(git diff *)`、`Bash(git log *)`、`Bash(git show *)`、`Bash(git grep *)`、`Bash(git add *)`、`Bash(git commit *)`、`Bash(git switch *)`、`Bash(git checkout *)`、`Bash(git branch *)`、`Bash(git stash *)`、`Bash(git fetch *)`、`Bash(git pull *)`、`Bash(git merge *)`、`Bash(git rebase *)`、`Bash(git tag *)`（リモートがあれば）`Bash(git push *)`。保護ブランチへのコミット・マージ・push と強制 push は、hook と `deny` の規則が先に止める |
| 検索（共通） | `Bash(grep *)`、`Bash(rg *)`、`Bash(find *)`、`Bash(git grep *)`。検索パターンに記号（`\|`、`\\`、`$`）を含む形が、Claude Code の組み込みの読み取り専用の判定から外れて確認になるのを避ける。`$(...)` を含むコマンドは、それでも確認になる |
| 設計文書への書き込み（共通） | `Edit(docs/**)`。区分 F に「設計文書の場所」があれば、その場所も（`Edit(design/**)`）。役の制限は hook が掛けるので、`allow` に入れても実装役が設計文書を書けるようにはならない |
| テスト DB への操作 | permissions には書かない。hook の `localOk`（手順 5）が、接続先がローカルと分かる形を通す。`pnpm exec *`・`pnpm run *`・`docker compose *` の許可と組み合わさって、確認なしで走る |

- **区分 E の開発環境が Windows なら、同じ規則を `PowerShell(...)` の形でも書く**。`Bash(...)` の規則は PowerShell ツールには効かない。`allow` だけでなく、`deny` と `ask` も同じ
- パッケージマネージャ全体（`Bash(pnpm *)`）、`Bash(docker *)`、`Bash(git *)` は入れない。公開や push まで通ってしまう
- `pnpm exec *` や `pnpm run *` は、その先で何が走るかを permissions からは見分けられない。`pnpm exec prisma migrate reset` は、hook の規則が捕まえる。`package.json` の scripts に書かれた中身（`pnpm run deploy` の実体）は、hook からも見えない。これは「仕組みでは止められないもの」に載せる
- `allow` は役ごとに分けられない。検証役や運用役も `git commit` できる。これは Policy 表の下に注記する。push だけは、hook が主セッションと運用役以外を止める（`git.pushRoles`）
- 開発環境が Windows で PowerShell ツールが使われるなら、検索は `PowerShell(Select-String *)`、`PowerShell(Get-ChildItem *)`、`PowerShell(rg *)` も足す

## permissions の書き方（確認済みの仕様）

2026-09-20 に公式ドキュメント（<https://code.claude.com/docs/en/permissions.md>）で確認した内容。

- **評価の順**は `deny` → `ask` → `allow`。最初に一致したものが結果になる。広い `deny` の中に、狭い `allow` で例外は作れない。より細かい `allow` があっても、`ask` が勝つ
- **Bash の規則**は、コマンドの文字列に対して `*` を任意の文字列として照合する。`Bash(npm run *)` は `npm run build` にも `npm run` にも一致する。`*` の無い規則は完全一致。`PowerShell(...)` も同じ形で、別の規則として書く
- **複合コマンド**（`&&`、`||`、`;`、`|` など）は、部分コマンドごとに照合される。`deny` と `ask` は、どれか1つの部分コマンドが一致すれば効く
- **Bash の規則は、安全の境界ではない**。同じプログラムを別の形で呼び出せば一致しない、と公式に明記されている。だから hook を主役にする
- **ファイルの規則**で参照されるのは `Edit(...)` と `Read(...)` だけ。`Write(...)` の規則は書けるが参照されない。`Edit(...)` が、ファイルを編集する組み込みツール全体に効く
- **パスの書き方**は gitignore の構文。`/path` はプロジェクトのルートからの相対、`//path` は絶対パス、`~/path` はホームから、`path` と `./path` は現在のディレクトリから。`.env` のような名前だけの規則は、任意の深さに一致する
- **`!` で始まる規則**は、同じ設定ファイルの同じ一覧の中で、それより前に書かれた `path` 形の規則から除外を作る。`Read(.env*)` の後に `Read(!.env.example)` を書く。順番を逆にすると効かない
- **出力のリダイレクト**（`> file`）と `tee` の書き込み先は、`Edit` の `allow` / `deny` と保護パスで検査される
- **規則は subagent にも効く**が、subagent ごとに別の規則は書けない
- **subagent 定義の `disallowedTools` に `Bash(git push *)` のような指定を書くと、Bash ツールが丸ごと外れる**。特定のコマンドだけを外すことはできない。役ごとのコマンド制限に使ってはいけない
- **hook の判定は規則を迂回しない**。hook が `allow` を返しても、一致する `deny` と `ask` は効く

## 仕組みでは止められないもの

hook と permissions が見ているのは、ツールの呼び出し（どのコマンドを、どのファイルに）まで。**実行されるコードの中身には効かない**。
次のものは止められないので、Policy 表に「仕組みでは止められない」と明記し、守り方を書く。プロジェクトに当てはまる行だけを載せる。

| 起こりうる事故 | なぜ止められないか | 守り方 |
|---|---|---|
| テストや動作確認で、本物の決済 API が呼ばれる | テストの実行は許可された操作で、その中で何が呼ばれるかは見えない | 開発環境にはテスト用のキーだけを置く。本番のキーを含むファイルは読めない |
| テストや動作確認で、実在の人にメッセージが届く | 同上 | 開発用の接続先を、送信しない設定にする。切り替えの仕組みを、詳細設計の要件に入れる |
| アプリケーションのコードや ORM から、本番 DB が書き換わる | 接続先は、コードと環境変数が決める | 本番の接続情報を開発環境に置かない |
| `package.json` の scripts など、別の名前で包まれた操作 | `pnpm run deploy` の中身は、コマンドの文字列からは見えない | 定義に名前が書かれている scripts は、その名前で規則にする（手順 3a）。それ以外は、実装役の定義で禁じ、scripts の変更を検証役とレシートで見つける |
| テストを本体と同じファイルに書く流儀の言語（Rust の単体テストなど）で、コード実装役がテストを書き換える | 同じファイルの中は、パスでは分けられない | 別ファイルのテストは分けられる。同じファイルのテストの変更は、レビュー役と検証役の基準で見つける |
| スクリプトを介した、役の範囲外への書き込み | hook が読めるのは、リダイレクト・`tee`・`rm`・`cp`・`mv`・`sed -i` などの、書き込み先が引数に現れる形まで | 検証役の却下の基準（スコープ外の変更）とレシートで見つける |
| 道具が未定の外部作用 | 規則にするコマンドが、まだ無い | 決まったらプロジェクト定義を更新して再実行する。それまでは人が実行する |
| 個人情報が、ログやテストデータに書き出される | 内容の検査はしていない | 実装役の定義と、検証役の却下の基準で守る |
| `localhost` を指しているが、実際には本番に届く（SSH のトンネル、ポートフォワード） | コマンドの文字列は `localhost` を指している | 本番へのトンネルを、開発環境で張ったままにしない |
| ブランチの保護の抜け道（`git branch -f main`、`git update-ref`、`git switch -C main`、別のリポジトリでの操作） | 見ているのは、コミット・マージ・rebase・cherry-pick・revert・am と push だけ | 保護ブランチへ入れる経路をプルリクエストに揃える。リモート側でもブランチ保護を設定する |

止められないものを正直に書くことには意味がある。利用者は、自分で守るべき場所を知ることができる。

## Policy 表の見せ方

利用者に確認を求めるときは、Policy 表を単独で見せる。ファイルの計画の中に埋もれさせない。安全の要であり、しかも推論で導いたものだからだ。

| 操作 | 根拠 | 階級 | 扱い | 規則 |
|---|---|---|---|---|
| 保護ブランチ（main・master・develop）へのコミット・マージ・push | 共通（git） | 不可逆・機微 | 禁止。作業ブランチからプルリクエストで入れる | hook `git.protectedBranches` |
| 作業ブランチへの push | E: GitHub | 可逆な変更 | 自動（主セッション・運用役だけ。作業のまとまりごとにコミットして push する） | permissions `Bash(git push *)`、hook `git.pushRoles` |
| タグの push、リモートのブランチの削除 | E: GitHub | 外部作用 | 承認（主セッション・運用役） | hook |
| プルリクエストの作成とマージ | E: GitHub | 外部作用 | 承認（主セッション・運用役） | hook `gh pr create`、`gh pr merge` |
| コンテナイメージの公開 | D: クラウドへのデプロイ／C: コンテナを動かせるクラウド／E: Docker | 外部作用 | 承認（主セッション・運用役） | hook `docker push` ほか |
| 本番 DB のマイグレーション | D: 本番 DB のマイグレーション／H: Prisma（未確定） | 不可逆・機微 | 承認（主セッション・運用役） | hook `prisma migrate deploy` |
| DB の初期化 | 同上 | 不可逆・機微 | 禁止。ただし接続先がローカルだと分かる形（`DATABASE_URL=...@localhost/...`、コンテナの中）は、テスト DB として通す | hook `prisma migrate reset`（`localOk`） |
| 秘密情報ファイルを読む | 共通 | 機微 | 禁止 | permissions `Read(.env*)` ほか |
| クラウドへのデプロイ（イメージの公開より先） | D: クラウドへのデプロイ | 外部作用 | **道具が未定のため、仕組みでは止められない** | 決まったら定義を更新して再実行 |
| テスト中に本物の課金が走る | D: 決済サービスへの課金 | 外部作用 | **仕組みでは止められない** | テスト用のキーだけを置く |

日常の操作の許可リスト（段階 3 以上）は、安全の判断ではないので、この表には混ぜない。表の下に「自動で許可する日常の操作」として一覧だけ添える。

確認のときに、次の3点を必ず聞く。

1. 承認にした操作のうち、禁止にしたいものはあるか
2. 禁止にした操作のうち、開発で実際に必要になるものはあるか
3. 表に無い、止めたい操作はあるか

利用者の答えで表を直し、確定した表を `docs/agent-architecture.md` に書く。
