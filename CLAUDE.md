# SPReAD-checker — プロジェクトガイド

第2回 SPReAD 公募（文科省 AI for Science）の**形式チェックツールを、Python不要・ブラウザだけ**で
使えるようにするプロジェクト。配布物は単一HTML（`docs/index.html`）。

- GitHub（Public）: https://github.com/takayuki1997/SPReAD-checker
- **公開URL（GitHub Pages・稼働中）: https://takayuki1997.github.io/SPReAD-checker/**
  - プロジェクトサイト（`/SPReAD-checker/`）。ユーザーサイト `https://takayuki1997.github.io/` とは別物で互いに無干渉。
  - 公開元は main ブランチの `/docs`。`docs/index.html` を push すれば自動再デプロイ（反映に数十秒〜数分）。
- ローカル作業ディレクトリ: `/Users/takayuki/Projects/SPReAD_CheckTool`
- ページ独自 favicon（青角丸＋白チェックのインラインSVG）を `<head>` に設定済み。ドメイン直下のトップサイトとは別アイコン。

## 何をするものか

文科省配布の2ツール（`research_plan_self_check.py`=様式1/Excel、`form_self_check.py`=様式0・2・3・4/PDF）の
判定ロジックを **無改変のまま** ブラウザ内 Python(Pyodide/WASM) で実行する。結果は配布版と同一。

利用フロー：①公式から入手した `.py` を読み込む → ②書類(.xlsx/.pdf)を読み込む → ③チェック実行
→ 判定サマリー/詳細チェックを画面表示＋結果Excelダウンロード。

## 重要な設計判断（変更時は理由を踏まえること）

1. **ブラウザ完結型(Pyodide)を採用**。理由：Win/Mac両対応・インストール不要・**書類をPC外に出さない**（機密）。
   サーバ型(アップロード式)は機密書類を預かる責任が生じるため不採用。
2. **文科省ツール(.py)は同梱しない**。利用者が公式配布元から入手して実行時に読み込む。
   理由：配布元規約が「改変版・コピーの第三者再配布を禁止／必ず公式配布元から入手」と定めるため、
   **無改変でも同梱配布は再配布に当たり得る**。同梱を避けることで規約を満たす。
   - 公式配布元（Box）: https://mext.ent.box.com/s/qf8vbuj3pso1hj9mwp1vs6rx2hashpuc/folder/385379226260
   - 自機関内に限り同梱したい場合のみ `node web/build.mjs --embed`（再配布論点が残る点に留意）。
3. **読み込んだ .py をブラウザにキャッシュ**（`localStorage`、書類は絶対にキャッシュしない）。
   **40日で自動失効**（公募中の更新への保険）。失効日数は template の `TOOL_CACHE_MAX_DAYS`。
   キャッシュはプロファイル×オリジンごとに分離（プロファイル/端末を変えると再読み込みが必要＝仕様）。
4. 配布方法は **B-1（URL配信）/ B-2（HTMLファイル直配布）** どちらも可。
   B-1の方が「更新の一括反映」「localStorageの安定」で有利。サーバ用意は学術情報センターに相談中。

## ⚠️ リポジトリに入れてはいけないもの（再配布禁止）

`.gitignore` で除外済み。**絶対にコミットしない**：
- `vendor/`（文科省ツール .py / README_v1.md）
- `samples/`（公式様式・そこから生成したPDF）
- `baseline*/`（検証出力）、`.venv/`、`node_modules/`
- 安全策として `*.xlsx *.xlsm *.pdf *.docx` も無視
- ビルド時は **同梱なし(既定)** を使うこと（`docs/index.html` に .py が混入しないこと。`PY_SCRIPTS = {}` を確認）

## ディレクトリ構成

```
web/app/index.template.html  UI本体（CSS/JS）。/*__PY_SCRIPTS__*/{} に同梱版を注入可
web/build.mjs                ビルド: 既定=同梱なし / --embed で vendor/*.py 埋め込み
docs/index.html              ★配布物の正本（自己完結HTML・Pages公開元・約23KB）
web/test_pyodide*.mjs        Node版Pyodideでの疎通確認（Excel/PDF）
web/test_runtime_load.mjs    実行時 .py 読み込み方式の確認
web/test_cache.mjs           localStorageキャッシュの復元・自動失効検証
web/e2e_test.mjs             実ブラウザE2E（http=B-1）
web/verify_fileurl.mjs       実ブラウザ検証（file://=B-2）+ screenshot.png 生成
tools/make_sample_pdfs.py    検証用サンプルPDF生成（reportlab+CJK。配布物外）
vendor/ samples/ baseline*/  ローカル検証用（gitignore対象）
```

## ビルド・テスト手順

```bash
# 検証用Python（global設定どおり venv 必須）
python3 -m venv .venv && .venv/bin/pip install openpyxl pdfminer.six pypdf reportlab
npm install                      # pyodide, puppeteer-core

node web/build.mjs               # 配布物生成（同梱なし）-> docs/index.html
node web/test_pyodide.mjs        # 様式1がPyodideで動くか
node web/test_pyodide_pdf.mjs    # PDFがPyodideで動くか
node web/test_cache.mjs          # キャッシュ復元・40日自動失効
node web/e2e_test.mjs            # 実ブラウザ(Chrome)E2E（http）
node web/verify_fileurl.mjs      # 実ブラウザ(file://) + スクショ
open docs/index.html             # 手動確認
```

- E2E/検証は システムChrome を puppeteer-core で使用
  （`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）。
- ライブラリ：openpyxl/pypdf/pdfminer.six は初回に micropip でPyPI取得、cryptography等はPyodide同梱。
  **初回起動のみネット接続が必要**（書類自体は送信されない）。

## 検証済みの事実

- 様式1：ネイティブ実行 vs Pyodide実行の判定結果が**全セル一致**（差分はファイルパス表示のみ）。
- 様式0/2/3/4：pdfminer抽出がPyodideでも動作、種別判定・結果がネイティブと一致。
- 実ブラウザ：http / file:// 両方で 投入→判定→表示→Excel DL 成功。キャッシュの復元・自動失効も成功。

## 上流（.py／様式）が変わったときの頑健性

このアプリは「公式 .py をそのまま実行する薄い殻」で、**判定ロジックも様式レイアウト（セル位置・シート名・文字数制限等）も一切持たない**。そのため大半の上流変更で無改修のまま動く。実機で「名前変更＋中身修正した .py」が殻無改修で完走することを確認済み。

- **様式 `.xlsx`／`.pdf` が変わった場合 → 殻は無関係で壊れない**。様式を理解しているのは .py 側。様式変更には文科省が対応 .py を出すので、新様式＋対応 .py を読み込めば動く。古い .py のまま新様式を入れると判定がズレ得る（公式ツール直実行でも同じ）が、40日キャッシュ失効＋「最新版を読み込み直して」表示で予防。
- **`.py` の中身修正（しきい値・メッセージ・チェック増減・セル位置変更）→ そのまま動き、新ロジックが自動反映**（利用者は新 .py を読み込むだけ）。
- **“壊れ得る”のは .py の外側インターフェース変更の稀なケースのみ**：
  1. 新しいライブラリが必要になる → import 失敗。対処：template の micropip インストール一覧に1行追加→再ビルド。
  2. `run(input_path=, output_file=)` の名称・引数変更 → 呼び出し1か所修正。READMEで公開APIとされ変更されにくい。
  3. ファイル名も中身マーカーも判別不能になる → `detectTool` の判別が外れる。`research_plan`/`form_self_check` という名 or 中身の特徴語（EXPECTED_SHEETS_BY_LANGUAGE/FILENAME_RULES 等）で判定。`_v2` 等の接尾辞は問題なし。

→ いずれも数行修正＋`node web/build.mjs`＋push で復旧可能。**運用方針：公募期間中に公式更新が出たら、一度通しで動作確認し、必要なら微修正する**。

## 文科省がツールを改訂したら（手順）

- 同梱なし（既定・推奨）：HTMLはUIのみのため原則改修不要。利用者が新しい .py を読み込めば追従。
  上記「壊れ得るケース」に該当する更新のときだけ template を調整して再ビルド・push。
- 同梱版：新しい .py を `vendor/` に上書き → `node web/build.mjs --embed` → 配布。

## 今後の候補（未着手）

- 完全オフライン版（Pyodide本体・wheelを同梱。ファイルは重くなる）。
- UI文言・レイアウト調整、①(.py入手)導線のさらなる親切化。

## 公開・実施済み

- GitHub Public リポジトリ作成、配布物を `docs/` に一本化、GitHub Pages で公開URL稼働。
- ページ独自 favicon 設定。
