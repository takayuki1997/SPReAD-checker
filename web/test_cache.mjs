// ツール(.py)キャッシュの検証: 読み込み→ページ再読み込みで自動復元されるか
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "web/dist");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function startServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = path.join(DIST, req.url === "/" ? "index.html" : decodeURIComponent(req.url));
      if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(p).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

async function main() {
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle2" });
  // ツール読み込み（_v1名のまま）
  await (await page.$("#fileTool")).uploadFile(
    path.join(ROOT, "vendor/research_plan_self_check_v1.py"),
    path.join(ROOT, "vendor/form_self_check_v1.py"));
  await page.waitForFunction(() => document.getElementById("stForm1").className === "chk", { timeout: 5000 });
  const cacheMsg = await page.$eval("#toolCache", e => e.textContent);
  console.log("[1] 読み込み後のキャッシュ表示:", cacheMsg.trim().slice(0, 60), "...");
  const ls = await page.evaluate(() => !!localStorage.getItem("spread_tools_cache_v1"));
  console.log("[2] localStorage 保存:", ls);

  // ページ再読み込み（アップロードし直さない）
  await page.reload({ waitUntil: "networkidle2" });
  const restored = await page.evaluate(() => ({
    f1: document.getElementById("stForm1").className,
    f2: document.getElementById("stForms").className,
    msg: document.getElementById("toolCache").textContent.trim(),
  }));
  console.log("[3] 再読み込み後:", restored.f1, restored.f2);
  console.log("    表示:", restored.msg.slice(0, 70), "...");

  // 失効テスト: 保存時刻を41日前に書き換えて再読み込み
  await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem("spread_tools_cache_v1"));
    o.savedAt = Date.now() - 41 * 86400000;
    localStorage.setItem("spread_tools_cache_v1", JSON.stringify(o));
  });
  await page.reload({ waitUntil: "networkidle2" });
  const expired = await page.evaluate(() => ({
    f1: document.getElementById("stForm1").className,
    msg: document.getElementById("toolCache").textContent.trim(),
    gone: localStorage.getItem("spread_tools_cache_v1") === null,
  }));
  console.log("[4] 41日経過後:", expired.f1, "/ 自動破棄:", expired.gone);
  console.log("    表示:", expired.msg.slice(0, 60), "...");

  await browser.close();
  server.close();
  const ok = ls && restored.f1 === "chk" && restored.f2 === "chk"
    && expired.f1 === "miss" && expired.gone && expired.msg.includes("破棄");
  console.log(ok ? "\n✅ キャッシュ: 復元・自動失効ともに成功" : "\n❌ キャッシュ検証に失敗");
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error("❌", e); process.exit(1); });
