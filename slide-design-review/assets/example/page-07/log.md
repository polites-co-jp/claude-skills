# Design review log: page 7

- デッキ: slides.md（slides.md:96-115、layout: md-standard）
- タイトル: 自動化は一度に全部やらず、3段階で広げる
- 開始: 2026-09-25 19:40
- 修正の上限: 3 回
- 開始時点のソース: git 管理外（md-to-slidev の完成例を一時フォルダに展開したもの）
- 規約メモ: md-to-slidev で作ったデッキ。slides.md に `<style>`・色・文字サイズ・UnoCSS のクラスを書かない。18px 未満の文字を使わない。色・サイズ・余白は style.css の変数、図は components/ の部品。layout は md-cover／md-toc／md-section／md-standard／md-wide だけ。md-standard の図の幅は figureWidth で 33〜55%。影・グラデーション・装飾アイコンを使わない。内容が少ないスライドの空きを装飾やイラストで埋めない

## 経過

| 回 | 画像 | レビュー（Critical / Major / Minor） | 今回直す問題 | 変更（範囲） | 比較 | 判断 |
|---|---|---|---|---|---|---|
| 0 | r0.png | review-1.md（0 / 3 / 4） | P1: 上詰めで下 2/3 が空き、3段階が左の箇条書きと右上の小さな図に分かれている（M1・M2）。P2（見出しの強弱）は場所も原因も別なので次回以降 | — | — | 修正 1 へ |
| 1 | r1.png | review-2.md（0 / 2 / 2） | P1: 箱が大きいのに中身が小さく、箱の中と下に空洞（M1）。箱の高さを詰める指摘だが、修正 1 の行き過ぎの調整で、元に戻す向きではない | changes-1.md: 箇条書きを箱に統合、md-wide へ、Step に size="lg"・Arrow に heavy を追加（共通: components/Step.vue・Arrow.vue・style.css。ただし新しい props だけに効く） | compare-1.md: 新が明確に良い／他ページ変化なし | 採用、続ける |
| 2 | r2.png | review-3.md（0 / 2 / 2） | P1: タイトルが主張行より弱く、カード見出しより小さい（M1・m2）。レビュー 1〜3 で毎回挙がった | changes-2.md: 箱の中身を拡大し、箱の高さを中身から決めて縦中央へ（共通: Step.vue・style.css。size="lg" だけに効く） | compare-2.md: 新が明確に良い／他ページ変化なし | 採用、続ける |
| 3 | r3.png | review-4.md（0 / 0 / 3） | — | changes-3.md: 7ページ目に header: lg を指定し、タイトル 54px 太字・主張行 32px 標準・グレーに（共通: layouts/md-wide.vue・style.css。header: lg だけに効く） | compare-3.md: 新が明確に良い／他ページ変化なし | 終了 |

## 終了

- 理由: 重大な問題なし（review-4 で Critical・Major が「なし」）。修正の上限（3回）にも同時に到達
- 最後のレビュー: review-4.md（Critical 0 / Major 0 / Minor 3）
- 残った指摘: 第1段階の強調が弱い（m1）、見出しと箱の間の空き（m2）、フッターの文字が小さく見える（m3。実際は 18px で、目視の見積もりの誤差）
- 往復の兆し: review-4 の P2(a) は箱の高さを約 480〜520px に広げる案で、修正 2 で 530px→約 415px に詰めた向きと逆。ここで止めたのは妥当
- 提案だけにしたこと: タイトルと主張行の段差をデッキ全体で揃えるか（changes-3.md の「提案」）。7ページ目だけタイトルが 54px になり、ほかのページ（32px）と大きさが揃わない
- 共通のファイルへの変更と、変化したほかのページ: components/Step.vue・Arrow.vue、layouts/md-wide.vue、style.css に、新しい props・frontmatter でだけ効く追加をした。3回とも全ページの画素比較で、変化は7ページ目だけ
