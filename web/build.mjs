// docs/index.html を生成する。
// 既定: 文科省ツール(.py)は同梱しない（利用者が実行時に各自読み込む）。
//        → 配布物に公式ツールを含まないため、再配布の懸念を避けられる。
// --embed: 自機関内で同梱したい場合のみ vendor/*.py を埋め込む（再配布に当たり得る点に留意）。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const VENDOR = path.join(ROOT, "vendor");
const TEMPLATE = path.join(ROOT, "web/app/index.template.html");
// 配布物の正本＝ docs/index.html（GitHub Pages の公開元も docs）
const OUT_DIR = path.join(ROOT, "docs");

const embed = process.argv.includes("--embed");
const SCRIPTS = ["research_plan_self_check.py", "form_self_check.py"];

let payload = {};
if (embed) {
  for (const name of SCRIPTS) payload[name] = fs.readFileSync(path.join(VENDOR, name), "utf8");
}

const template = fs.readFileSync(TEMPLATE, "utf8");
const marker = "/*__PY_SCRIPTS__*/{}";
if (!template.includes(marker)) throw new Error("埋め込みマーカーが見つかりません: " + marker);
// JSON.stringify は < をエスケープしないため、埋め込む .py に "</script>" が
// 含まれるとインラインスクリプトが早期終了する。< に退避して防ぐ（--embed時のみ関係）。
// 関数置換にして、置換文字列内の $ が特殊扱いされる問題（.py 中の $）も回避。
const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");
const html = template.replace(marker, () => payloadJson);

fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, "index.html");
fs.writeFileSync(outFile, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`生成: ${outFile} (${kb} KB)  ← 配布物の正本 / GitHub Pages 公開元`);
console.log(embed ? `モード: 同梱あり (${SCRIPTS.join(", ")})`
                  : "モード: 同梱なし（利用者が .py を実行時に読み込む）");
