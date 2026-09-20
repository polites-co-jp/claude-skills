---
schema: project-definition/1
status: complete
updated: 2026-09-20
---

# Project Definition: 小規模店舗向け予約管理サービス

## A. 目的とスコープ

| 項目 | 内容 | 状態 |
|---|---|---|
| 目的 | 美容室や整体院のような小規模店舗が、電話に出られない時間帯の予約の取りこぼしを無くす。来店客が Web から予約と事前決済を行い、店舗側は予約の一覧を管理できる（根拠: `README.md`） | assumed |
| やること | 来店客向けの予約受付（根拠: `apps/web/app/(public)/`） | assumed |
| やること | 店舗向けの予約管理画面（根拠: `apps/web/app/admin/`） | assumed |
| やること | 事前決済（根拠: 依存 `stripe`） | assumed |
| やること | 予約確認の通知（根拠: 依存 `resend`） | assumed |
| やらないこと | モバイルアプリは作らない。Web だけで提供する | decided |
| やらないこと | 複数店舗をまたぐチェーン向けの機能 | decided |
| 制約 | 導入済みの店舗が3軒あり、稼働中。予約と決済を止める変更は、営業時間外に行う | decided |

## B. システム境界

| 項目 | 内容 | 状態 |
|---|---|---|
| 利用者との接点 | 来店客向けの Web 画面（根拠: `apps/web/app/(public)/`） | assumed |
| 利用者との接点 | 店舗向けの管理画面（根拠: `apps/web/app/admin/`） | assumed |
| 処理 | サーバー側で予約の受付と管理を行う（根拠: `apps/web/app/api/`、`Dockerfile`） | assumed |
| データの保存先 | PostgreSQL に店舗・予約・来店客の情報を保存する（根拠: `prisma/schema.prisma`） | assumed |
| 外部とのやりとり | Stripe（カード決済の課金と返金）（根拠: 依存 `stripe`、`.env.example` の `STRIPE_SECRET_KEY`） | assumed |
| 外部とのやりとり | Resend（予約確認と前日の通知のメール送信）（根拠: 依存 `resend`、`.env.example` の `RESEND_API_KEY`） | assumed |
| 利用者の識別（認証） | 店舗側はログインが必要。来店客はログインなしで予約できる（根拠: 依存 `next-auth`、`apps/web/middleware.ts`） | assumed |
| 配布・実行場所 | Fly.io 上で動かす（根拠: `fly.toml`） | assumed |

```text
来店客向け Web 画面 ─┐
                     ├→ Next.js のサーバー（Fly.io） → PostgreSQL
店舗向け管理画面   ──┘         │
                               ├→ Stripe（外部）
                               └→ Resend（外部）
```

## C. 技術

| 項目 | 内容 | 状態 |
|---|---|---|
| 言語 | TypeScript（根拠: `package.json`、`tsconfig.json`） | assumed |
| ランタイム | Node.js 22（根拠: `.nvmrc`、`package.json` の `engines`） | assumed |
| パッケージマネージャ | pnpm（根拠: `pnpm-lock.yaml`、`package.json` の `packageManager`） | assumed |
| 主要フレームワーク | Next.js（根拠: 依存 `next`） | assumed |
| DB 種別 | PostgreSQL（根拠: `docker-compose.yml` の `image`、`prisma/schema.prisma` の `provider`） | assumed |
| デプロイ先種別 | Fly.io（コンテナ）（根拠: `fly.toml`、`Dockerfile`） | assumed |

## D. リスク

| 項目 | 内容 | 状態 |
|---|---|---|
| 外部作用 | Stripe への課金と返金の依頼。実際にお金が動く（根拠: 依存 `stripe`） | assumed |
| 外部作用 | 開発中の Stripe は、テスト用のキーを使っている | decided |
| 外部作用 | Stripe の管理画面から、手作業で返金することがある。リポジトリの外で行う操作 | decided |
| 外部作用 | Resend による予約確認メールの送信。実在の来店客に届く（根拠: 依存 `resend`） | assumed |
| 外部作用 | 開発中の Resend は、本物のキーを使っている。開発環境からも実際に送信される。宛先は開発者自身のアドレスだけにしている | decided |
| 外部作用 | Fly.io への本番デプロイ（`flyctl deploy`）。`main` への `git push` で、GitHub Actions が自動的に走らせる（根拠: `.github/workflows/deploy.yml`） | assumed |
| 外部作用 | 手動のデプロイはしていない。デプロイは CI からだけ | decided |
| 不可逆・機微な操作 | 本番 DB のマイグレーション（`prisma migrate deploy`）。デプロイの手順の中で自動的に走る（根拠: `fly.toml` の `release_command`） | assumed |
| 不可逆・機微な操作 | `pnpm db:reset`（中身は `prisma migrate reset --force`）。接続先の DB を消して作り直す。接続先は `DATABASE_URL` で決まる（根拠: `package.json` の scripts） | assumed |
| 不可逆・機微な操作 | 本番 DB への手作業での接続（`psql`）。接続情報は開発者の手元にある。障害対応で、年に数回使う | decided |
| 秘密情報・個人情報 | 秘密情報: Stripe と Resend の API キー、DB の接続情報、認証の秘密鍵（根拠: `.env.example` のキー名。`.env` の中身は読んでいない） | assumed |
| 秘密情報・個人情報 | 個人情報: 来店客の氏名・メールアドレス・電話番号（根拠: `prisma/schema.prisma` の `Customer`） | assumed |
| 秘密情報・個人情報 | カード番号は自前で保持せず、Stripe に任せている | decided |

## E. 環境

| 項目 | 内容 | 状態 |
|---|---|---|
| 開発環境 | Windows。DB は Docker のコンテナで動かす（根拠: `docker-compose.yml`） | assumed |
| 実行環境の段階 | local と本番。staging は無い | decided |
| リポジトリのホスティング | GitHub（根拠: git のリモート） | assumed |
| CI | GitHub Actions。テストと、`main` へのデプロイ（根拠: `.github/workflows/`） | assumed |

## F. リポジトリ構成

| 項目 | 内容 | 状態 |
|---|---|---|
| 単一か分離か | 単一のリポジトリ。pnpm のワークスペース（根拠: `pnpm-workspace.yaml`） | assumed |
| 最上位の配置 | `apps/web`（アプリケーション本体）、`prisma`（スキーマとマイグレーション）、`design`（既存の設計文書） | assumed |
| 新規か既存か | 既存 | decided |
| 設計文書の場所 | `design/`（根拠: `design/*.md` が 6 件） | assumed |

## G. 運用前提

| 項目 | 内容 | 状態 |
|---|---|---|
| ソロかチームか | 2人（根拠: コミットの著者が2人） | assumed |
| 試作か本番品質か | 本番品質。3軒の店舗で稼働中で、実際にお金が動く | decided |

## H. 未決・持ち越し

- [deferred] 既存の検証系コマンド: `pnpm test`（vitest）、`pnpm lint`、`pnpm typecheck`（根拠: `package.json` の scripts）。これらを一括で走らせる scripts は、定義されていない
- [deferred] 食い違い: `pnpm-lock.yaml` と `package-lock.json` の両方がある。`packageManager` の欄・CI・Dockerfile は pnpm。ユーザーによれば、`package-lock.json` は消し忘れ
- [deferred] 今後の予定: ORM を Prisma から Drizzle に移したい。現状は Prisma のまま。移行は未着手
- [deferred] 来年、予約の通知を LINE でも送りたい
- [deferred] staging 環境を作るかどうかは、未定
