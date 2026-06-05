// 実ブラウザ(Chrome)でのE2E検証: dist/index.html を開き、サンプルを投入して結果を確認する
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "docs");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript" };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = path.join(DIST, req.url === "/" ? "index.html" : decodeURIComponent(req.url));
      if (!fs.existsSync(p)) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;
  console.log("[server]", url);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage();
  page.on("console", (m) => { const t = m.text(); if (/error|Error|❌/.test(t)) console.log("  [page]", t); });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  console.log("[1] ページ読み込み完了");

  // ① ツール(.py)を読み込む（利用者が公式から入手した想定）
  const tForm1 = path.join(ROOT, "vendor/research_plan_self_check_v1.py");
  const tForms = path.join(ROOT, "vendor/form_self_check_v1.py");
  await (await page.$("#fileTool")).uploadFile(tForm1, tForms);
  await page.waitForFunction(() => document.getElementById("stForm1").className === "chk"
    && document.getElementById("stForms").className === "chk", { timeout: 5000 });
  console.log("[2a] ツール読み込み: research_plan / form_self_check (_v1名のまま)");

  // ② サンプル書類を input に設定（様式1 Excel + 様式0 PDF）
  const f1 = path.join(ROOT, "samples/form1/第2回_様式1_研究計画調書.xlsx");
  const f2 = path.join(ROOT, "samples/forms0234/第2回_様式0_申請様式チェックリスト_1234_TaroYamada.pdf");
  await (await page.$("#file")).uploadFile(f1, f2);
  console.log("[2b] 書類投入: 様式1.xlsx, 様式0.pdf");

  await page.waitForFunction(() => !document.getElementById("run").disabled, { timeout: 5000 });
  await page.click("#run");
  console.log("[3] チェック実行 → エンジン読込＆処理中（最大3分）...");

  await page.waitForFunction(() => document.getElementById("status").textContent.includes("完了"),
    { timeout: 180000 });
  console.log("[4] 処理完了");

  // 結果検証
  const result = await page.evaluate(() => {
    const heads = [...document.querySelectorAll("#results h2")].map(e => e.textContent);
    const badges = [...document.querySelectorAll("#results .badge")].map(e => e.textContent.trim());
    const names = [...document.querySelectorAll("#results .filehead .name")].map(e => e.textContent);
    const dls = [...document.querySelectorAll("#results a.dl")].map(e => e.getAttribute("download"));
    const detailRows = document.querySelectorAll("#results details table tr").length;
    // 表示退行(色分けの欠落・誤り)検出用: バッジの ok/ng クラスと、色付けされたセル数
    const badgeClasses = [...document.querySelectorAll("#results .badge")].map(e => e.className);
    const coloredCells = document.querySelectorAll("#results td.s-ok, #results td.s-warn, #results td.s-ng").length;
    return { heads, badges, names, dls, detailRows, badgeClasses, coloredCells };
  });
  console.log("[5] 結果:");
  console.log("    見出し:", result.heads);
  console.log("    対象ファイル:", result.names);
  console.log("    総合判定バッジ:", result.badges, result.badgeClasses);
  console.log("    DLファイル名:", result.dls);
  console.log("    詳細チェック行数:", result.detailRows);
  console.log("    色分けセル数:", result.coloredCells);

  await browser.close();
  server.close();

  const ok = result.heads.length === 2 && result.badges.length === 2 &&
             result.dls.length === 2 && result.dls.every(Boolean) && result.detailRows > 20 &&
             // 総合判定バッジは ok/ng のいずれかが必ず付与される
             result.badgeClasses.every(c => /\b(ok|ng)\b/.test(c)) &&
             // classify が判定値を色付けしている（語彙ズレで全無色になる退行を検出）
             result.coloredCells > 0;
  console.log(ok ? "\n✅ 実ブラウザE2E: 成功" : "\n❌ 実ブラウザE2E: 期待に未達");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
