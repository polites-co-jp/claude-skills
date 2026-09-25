# 変更 1: page 7

## 直した問題
- Priority 1（[M1] [M2] [m1] [m2]）: 3段階の情報が左の箇条書きと右上の小さな図に分かれ、どちらも上30%に収まって下2/3が空いている。項目数が18pxで目立たず、箱の内側余白と矢印が細く弱い

## 原因
- slides.md: layout が md-standard で、段階名＋中身を本文の箇条書き（左）、段階名＋項目数を `::figure::` の Step（右 45%）に分けて書いていた。同じ情報が2か所に出ていた
- style.css: `.md-body` は上詰めで、`.md-figure` の高さは中身で決まる。Step は `align-items: center` で箱の高さが文字の高さだけになり、約80pxの帯にしかならなかった
- components/Step.vue: 箱の内側余白が `--md-box-pad`（10px 16px）、項目数（sub）が `--md-size-note`（18px）、矢印が既定 28px・線 1.25px。大きく見せる手段が部品に無かった
- md-standard は図の幅が figureWidth 33〜55% に限られ、本文欄も残るため、図を横幅いっぱいにできない

## 変更
| ファイル | 場所 | 変更前 | 変更後 | 範囲 |
|---|---|---|---|---|
| slides.md | 7ページ目の frontmatter | layout: md-standard | layout: md-wide | このページだけ |
| slides.md | 7ページ目の本文 | 箇条書き3行（段階名＋中身）＋ `::figure::` に `<Step :items="[{ label, sub: '約50項目' }…]">` | 箇条書きと `::figure::` を削除し、`<Step size="lg" :items="[{ label: '第1段階', prefix: '約', value: '50', unit: '項目', desc: 'ログインと主要な画面遷移' }, …]" :highlight="[0]" />` の1つにまとめた | このページだけ |
| components/Step.vue | props | arrow 既定 28 | `size`（'md' 既定 / 'lg'）を追加。arrow 既定は md で 28、lg で 60 | size="lg" を指定したときだけ変わる。ほかのページの Step（slides.md の縦の工程図1か所・横の工程図1か所）は md のまま |
| components/Step.vue | テンプレート | label と sub だけ | item に `value`（大きな数字）・`prefix`／`unit`（数字の前後の小さな語）・`desc`（中身の文）を追加。lg では矢印に `heavy` を渡す | 新しいキーを使ったときだけ表示される。既存ページは変化なし |
| components/Step.vue | scoped style | なし | `.size-lg`: 箱の高さ `--md-step-lg-height`（530px）、箱の間隔 `--md-gap-columns`（36px）、上の間隔を結論から 80px に（`--md-gap-conclusion-figure` − `--md-gap-conclusion-body`）、内側余白 40px、中身を縦中央に積む。段階名 32px（`--md-size-title`）太字、数字 72px、「約」「項目」28px（`--md-size-conclusion`）、中身の文 24px。強調の箱だけ数字と中身の文も太字 | size="lg" だけ |
| components/Arrow.vue | props・描画 | strong（2px）まで | `heavy` を追加。線 3px（`--md-stroke-heavy`）、矢じり 14px、SVG の太さ 24px | heavy を指定したときだけ。既存の Arrow（Architecture・既存の Step）は変化なし |
| style.css | :root | なし | `--md-size-figure-num: 72px` `--md-size-figure-desc: 24px` `--md-gap-conclusion-figure: 80px` `--md-stroke-heavy: 3px` `--md-box-pad-lg: 40px` `--md-step-lg-height: 530px` `--md-step-lg-gap: 20px` を追加 | 変数の追加だけ。使うのは Step size="lg" と Arrow heavy だけなので、ほかのページは変化なし |

## 意図した見た目の変化
- 左の箇条書きが消え、3段階の情報（段階名・項目数・中身の文）が1つの横並びの図にまとまる。左右を見比べる必要がなくなる
- 図は左端 48px〜右端 1872px の横幅いっぱい。箱は各 約520px 幅（(1824 − 矢印60×2 − 間隔36×4) / 3）、高さ 530px
- 縦位置は結論の下端（y≈140）から 80px 下の y≈220 から始まり、下端は y≈750。フッター上端（y≈1013）までの空きは約260px で、画面の1/4以下
- 箱の中は上から「第1段階」（32px 太字）→「約 50 項目」（数字 72px、「約」「項目」28px）→「ログインと主要な画面遷移」（24px）。内側余白 40px、中身は箱の縦中央
- 矢印は長さ 60px・線 3px・矢じり大きめで、箱の縦中央に置かれる
- 第1段階の箱だけが濃い枠（2px・アクセント色）と太字（数字と中身の文）のまま。ほかの2つは段階名だけ太字で、数字と中身の文は標準
- 色は従来どおり黒とグレー（強調枠のアクセント色を含め既存の変数だけ）。影・グラデーション・アイコンは追加していない
- 左端 48px・右端 1872px の揃いは md-wide の余白（`--md-pad-x`）で保たれる

## 規約との関係
- 改善案の「図を横幅いっぱい」は md-standard の figureWidth（33〜55%）では実現できないため、許可された layout の md-wide に切り替えた
- 文字サイズ・余白・線の太さは slides.md に書けないため、style.css に変数を足し、components/ の Step と Arrow に `size="lg"` と `heavy` の型を足して、slides.md からは props だけで指定した
- 改善案の箱の高さ（約380〜450px）と縦位置（副題の下 約80px から、下端 y≈750〜800）は両立しない（y≈220 から 450px だと下端 y≈670 で、下の空きが1/4を超える）。「直ったと分かる見え方」の「下の空きが1/4以下」を優先して、高さを 530px にした
- 改善案の「段階名は太字」と「第1段階だけ太字で強調」は重なるため、段階名は全箱で太字、強調の箱だけ数字と中身の文も太字にして、太字の差を残した
- 最小文字サイズ 18px を下回る文字は使っていない（最小は「約」「項目」の 28px）

## 採らなかった案
- md-standard のまま figureWidth を 55% にする: 図が右半分に収まるだけで、横幅いっぱいにならず、箇条書きとの分割も解消しない
- slides.md で Box と Arrow を並べて組む: 数字 72px などのサイズ指定を slides.md に書く必要があり規約に反する
- 新しい部品（例: StageFlow.vue）を作る: 役割が Step と同じで、同じ役割の部品が2つになる。Step に型を足すほうが変更が小さい
- 図を本文領域の上下中央に置く: 上の間隔が約190pxになり、結論と図が離れて見える。改善案の「副題の下 約80px」に合わせて上寄せの固定間隔にした

## 気づいたが直していないこと
- Priority 2（[M3]）: タイトル（32px・500）と結論（28px・太字）の強さが近い問題は今回の対象外のため触っていない
- 強調の箱の枠は 2px（`--md-stroke-strong`）で、今回 3px にした矢印（黒）より細い。矢印のほうが強く見える可能性がある
- Arrow の SVG は線端・矢じり先端が viewBox の端にあり、線の太さの半分が切れる（既存の細い矢印でも同じ）。3px では先端がわずかに丸く欠けて見える可能性がある

## 提案（この役では実施しないこと）
- なし
