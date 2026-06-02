// Pyodide 疎通確認（Node版）: オリジナル様式1ツールをブラウザと同じWASM上で実行する
import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  console.log("[1] Pyodide 起動中...");
  const pyodide = await loadPyodide();

  console.log("[2] micropip でライブラリ導入中 (openpyxl, pypdf, pdfminer.six)...");
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  await micropip.install(["openpyxl", "pypdf", "pdfminer.six"]);
  console.log("    -> 導入完了");

  // 仮想FSへ オリジナル.py と サンプル様式1 を配置
  const script = fs.readFileSync(path.join(ROOT, "vendor/research_plan_self_check.py"), "utf8");
  pyodide.FS.writeFile("/research_plan_self_check.py", script);

  pyodide.FS.mkdirTree("/work/in");
  pyodide.FS.mkdirTree("/work/out");
  const sampleName = "第2回_様式1_研究計画調書.xlsx";
  const sampleBytes = fs.readFileSync(path.join(ROOT, "samples/form1", sampleName));
  pyodide.FS.writeFile(`/work/in/${sampleName}`, sampleBytes);

  console.log("[3] オリジナル run() を Pyodide 上で実行中...");
  const resultPath = await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, "/")
import research_plan_self_check as r
p = r.run(input_path="/work/in", output_file="/work/out/result.xlsx")
str(p)
`);
  console.log("    -> 出力:", resultPath);

  // 出力xlsxを取り出して保存（ネイティブ基準と比較するため）
  const outBytes = pyodide.FS.readFile(resultPath);
  fs.mkdirSync(path.join(ROOT, "baseline_pyodide"), { recursive: true });
  const outFile = path.join(ROOT, "baseline_pyodide", path.basename(resultPath));
  fs.writeFileSync(outFile, outBytes);
  console.log("[4] 取り出し保存:", outFile, `(${outBytes.length} bytes)`);
  console.log("\n✅ Pyodide 上でオリジナル様式1ツールが動作しました。");
}

main().catch((e) => { console.error("❌ 失敗:", e); process.exit(1); });
