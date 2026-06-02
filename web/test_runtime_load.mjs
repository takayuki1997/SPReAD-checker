// 実行時に .py を読み込んで動かせるか（同梱しない方式）の確認
import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  await pyodide.pyimport("micropip").install(["openpyxl", "pypdf", "pdfminer.six"]);

  // 利用者が選んだ想定の .py（公式配布の _v1 名のまま）をテキストで読み込む
  const userPy = fs.readFileSync(path.join(ROOT, "vendor/research_plan_self_check_v1.py"), "utf8");
  // 正準モジュール名でFSに書く（アップロード名が _v1 でも import 名は固定にできる）
  pyodide.FS.writeFile("/research_plan_self_check.py", userPy);

  pyodide.FS.mkdirTree("/work/in"); pyodide.FS.mkdirTree("/work/out");
  const name = "第2回_様式1_研究計画調書.xlsx";
  pyodide.FS.writeFile(`/work/in/${name}`, fs.readFileSync(path.join(ROOT, "samples/form1", name)));

  const out = await pyodide.runPythonAsync(`
import sys
if "/" not in sys.path: sys.path.insert(0, "/")
sys.modules.pop("research_plan_self_check", None)
import research_plan_self_check as r
str(r.run(input_path="/work/in", output_file="/work/out/result.xlsx"))
`);
  const bytes = pyodide.FS.readFile(out);
  console.log("出力:", out, `(${bytes.length} bytes)`);
  console.log("✅ 同梱せず、実行時読み込みでも様式1ツールが動作");
}
main().catch(e => { console.error("❌", e); process.exit(1); });
