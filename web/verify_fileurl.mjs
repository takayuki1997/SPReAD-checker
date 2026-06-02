// B-2検証: file:// で index.html を直接開いて動作＆スクリーンショット取得
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fileUrl = "file://" + path.join(ROOT, "web/dist/index.html");

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1400 });
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  console.log("[file://]", fileUrl);
  await page.goto(fileUrl, { waitUntil: "networkidle2", timeout: 60000 });

  await (await page.$("#fileTool")).uploadFile(
    path.join(ROOT, "vendor/research_plan_self_check_v1.py"),
    path.join(ROOT, "vendor/form_self_check_v1.py"));
  await page.waitForFunction(() => document.getElementById("stForm1").className === "chk", { timeout: 5000 });
  const f1 = path.join(ROOT, "samples/form1/第2回_様式1_研究計画調書.xlsx");
  const f2 = path.join(ROOT, "samples/forms0234/第2回_様式0_申請様式チェックリスト_1234_TaroYamada.pdf");
  await (await page.$("#file")).uploadFile(f1, f2);
  await page.waitForFunction(() => !document.getElementById("run").disabled, { timeout: 5000 });
  await page.click("#run");
  await page.waitForFunction(() => document.getElementById("status").textContent.includes("完了"),
    { timeout: 180000 });
  // 詳細を開いた状態でスクショ
  await page.evaluate(() => document.querySelectorAll("#results details").forEach(d => d.open = true));
  const shot = path.join(ROOT, "web/screenshot.png");
  await page.screenshot({ path: shot, fullPage: true });
  console.log("[screenshot]", shot);

  const ok = await page.evaluate(() => document.querySelectorAll("#results .badge").length === 2);
  await browser.close();
  console.log(ok ? "✅ file:// でも動作（B-2 OK）" : "❌ file:// で結果が出ませんでした");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });
