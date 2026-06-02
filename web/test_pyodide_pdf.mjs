// Pyodide 疎通確認(PDF側): form_self_check をブラウザ同等WASM上で実行する
import { loadPyodide } from "pyodide";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  console.log("[1] Pyodide 起動...");
  const pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  console.log("[2] ライブラリ導入(pdfminer.six, pypdf, openpyxl)...");
  await micropip.install(["openpyxl", "pypdf", "pdfminer.six"]);

  pyodide.FS.writeFile("/form_self_check.py",
    fs.readFileSync(path.join(ROOT, "vendor/form_self_check.py"), "utf8"));
  pyodide.FS.mkdirTree("/work/in");
  pyodide.FS.mkdirTree("/work/out");
  for (const name of fs.readdirSync(path.join(ROOT, "samples/forms0234"))) {
    if (!name.toLowerCase().endsWith(".pdf")) continue;
    pyodide.FS.writeFile(`/work/in/${name}`,
      fs.readFileSync(path.join(ROOT, "samples/forms0234", name)));
  }

  console.log("[3] form_self_check.run() を実行...");
  const resultPath = await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, "/")
import form_self_check as f
str(f.run(input_path="/work/in", output_file="/work/out/result.xlsx"))
`);
  console.log("    -> 出力:", resultPath);

  const outBytes = pyodide.FS.readFile(resultPath);
  fs.mkdirSync(path.join(ROOT, "baseline_pyodide"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "baseline_pyodide", path.basename(resultPath)), outBytes);
  console.log(`[4] 取り出し保存 (${outBytes.length} bytes)`);
  console.log("\n✅ Pyodide 上で PDF側ツール(form_self_check)が動作しました。");
}

main().catch((e) => { console.error("❌ 失敗:", e); process.exit(1); });
