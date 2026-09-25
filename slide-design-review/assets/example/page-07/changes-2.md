# 変更 2: page 7

## 直した問題
- Priority 1（[M1]）: 3つの箱（各 約520×530px）の中身が中央の高さ約200pxにしか入らず、箱の上下に約170pxずつ空洞がある。箱の群れが上に寄り、箱の下からフッタまで約260px空いている

## 原因
- components/Step.vue（size="lg"）: 箱の高さを `--md-step-lg-height`（530px）で固定し、中身を `justify-content: center` で縦中央に置いていた。中身の高さ（約200px）と関係なく箱が530pxになるため、上下に空洞ができた
- 同じく size="lg": 縦位置を `margin-top: calc(--md-gap-conclusion-figure − --md-gap-conclusion-body)`（58px）で結論の下に固定していた。本文領域（結論の下〜フッタの上）の高さに対して上詰めなので、下に約260pxの帯が残った
- 中身の文字サイズが箱の大きさに対して小さかった: 数字 `--md-size-figure-num` 72px、段階名 `--md-size-title` 32px、「約」「項目」`--md-size-conclusion` 28px、説明 `--md-size-figure-desc` 24px

## 変更
| ファイル | 場所 | 変更前 | 変更後 | 範囲 |
|---|---|---|---|---|
| style.css | :root `--md-size-figure-num` | 72px | 130px | Step size="lg" だけ（使っているのは7ページ目だけ） |
| style.css | :root `--md-size-figure-desc` | 24px | 32px | 同上 |
| style.css | :root | なし | `--md-size-figure-label: 44px`（段階名）と `--md-size-figure-unit: 40px`（「約」「項目」）を追加 | 同上 |
| style.css | :root `--md-box-pad-lg` | 40px | 60px 40px（上下60・左右40） | 同上 |
| style.css | :root | `--md-step-lg-height: 530px` と `--md-gap-conclusion-figure: 80px` | 削除（使う所がなくなったため） | 同上 |
| components/Step.vue | `.md-step.size-lg` | `height: var(--md-step-lg-height)`、`margin-top: calc(...)`（58px） | 高さの指定を外し、`margin: auto 0` で本文領域の上下中央に置く | size="lg" だけ |
| components/Step.vue | `.size-lg .md-step-label` | `--md-size-title`（32px） | `--md-size-figure-label`（44px） | size="lg" だけ。タイトルの変数とは切り離した |
| components/Step.vue | `.size-lg .md-step-unit` | `--md-size-conclusion`（28px） | `--md-size-figure-unit`（40px） | size="lg" だけ。結論の変数とは切り離した |
| components/Step.vue | 冒頭のコメント | — | lg は本文領域の上下中央に置き、箱の高さは中身と余白で決まることを追記 | 動作なし |

slides.md は変更していない。

## 意図した見た目の変化
- 箱の中身が大きくなる: 段階名 44px 太字 → 「約 50 項目」（数字 130px、「約」「項目」40px）→ 説明 32px。中身の高さは約295px（段階名 約62 ＋ 数字の行 約145 ＋ 説明 48 ＋ 行間 20×2）
- 箱の高さは中身＋上下60pxで約415px（改善案の約420〜450pxの範囲の下端付近）。中身が占める割合は約7割で、半分を超える。3つの箱の高さは揃ったまま（横並びの stretch）
- 箱の群れは本文領域（結論の下端 y≈140 から 22px 下 〜 フッタ上端 y≈1013 の 16px 上）の上下中央に置かれ、箱の中心は y≈580、上端 y≈372、下端 y≈787 になる見込み。結論の下端から箱までの空き約230px と、箱からフッタまでの空き約225px がほぼ同じになり、下だけに大きな帯が残らない
- 箱の幅（約520px）・間隔（36px）・矢印（長さ60px・線3px）は変えていない。矢印は `align-self: center` のままなので、箱の縦中央の線に乗る
- 横幅の確認: 箱の内側は約440px。「約 200 項目」は約360px、「ログインと主要な画面遷移」（12字×32px）は約384pxで、いずれも1行に収まる見込み
- 良い点の維持: 左右の外周（x≈48 / x≈1871）は md-wide の余白のまま。段階名→数字→説明の順と、数字が最大であることは変わらない。第1段階だけ太字（数字と説明）、第2・第3段階は細字の強弱も変わらない。色・装飾は追加していない

## 規約との関係
- 文字サイズ・余白は slides.md に書けないため、style.css の変数と components/Step.vue の size="lg" のスタイルで変えた。slides.md は触っていない
- 段階名と「約」「項目」は、これまでタイトル・結論の変数を流用していた。改善案のサイズ（44px・40px）にするとタイトル・結論まで変わってしまうため、図専用の変数 `--md-size-figure-label` `--md-size-figure-unit` を足して切り離した
- 最小文字サイズ 18px を下回る文字はない（この図の最小は説明の 32px）

## 採らなかった案
- 箱の高さを変数で 430px などに固定し直す: 中身の大きさが変わるたびに高さの調整が要り、今回の空洞と同じ原因を残す。高さは中身と内側余白で決まるようにした
- 縦位置を結論からの固定間隔で下げる: 本文領域の高さに依存しないので、上下の空きが揃う保証がない。`margin: auto 0` で上下中央にした
- 箱の間隔や矢印を大きくして横に広げる: 改善案が「箱の幅と間隔、矢印の位置は今のまま」としているため触らない

## 気づいたが直していないこと
- Priority 2（[M2]）: タイトル（32px・500）と結論（28px・太字）の強さが近い問題は今回の対象外。今回、数字が130pxになるので、タイトルとの差はさらに開く
- Priority 3（[m1]）: 第1段階の枠の強調が薄い（2px・Blue Gray と 1.25px の薄いグレーの差）問題は今回の対象外
- 変更1の記録にある Arrow の SVG 端で線幅の半分が切れる件は未対応のまま

## 提案（この役では実施しないこと）
- なし
