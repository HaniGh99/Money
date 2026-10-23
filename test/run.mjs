// اختبار سكربت GitHub Actions بمحاكاة Gemini (بلا شبكة)
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateMarket, parseJSON } from "../scripts/market-lib.mjs";
let ok = 0; const t = (n, f) => { f(); ok++; console.log("✔", n); };
const good = { usd: { b: 141, s: 141.75 }, g21: { b: 16405, s: 16617 }, ounce: 4136, official: { b: 121.5, s: 122.5 }, summary: "خلاصة", sources: ["الليرة اليوم"], advice: [{ c: "تنظيمي", l: "warn", t: "تعامل مع الجهات المرخّصة فقط لتقليل المخاطر.", s: "سانا", x: "2026-11-01" }] };
t("parseJSON", () => assert.equal(parseJSON("```json\n{\"a\":1}\n```").a, 1));
t("validate يقبل ويرفض المقياس القديم", () => { assert.equal(validateMarket(good, null).usd.b, 141); assert.equal(validateMarket({ ...good, usd: { b: 14100, s: 14175 } }, { usd: { b: 140, s: 141 } }).usd.b, 140); });
t("بدون مفتاح: يتخطى بسلام", () => { const r = spawnSync("node", ["scripts/refresh-market.mjs"], { env: { ...process.env, GEMINI_API_KEY: "" }, encoding: "utf8" }); assert.equal(r.status, 0); assert.match(r.stdout, /تخطّي/); });
// خادم محاكاة محلي لـ Gemini
import http from "node:http";
const srv = http.createServer((req, res) => { let b = ""; req.on("data", (d) => b += d); req.on("end", () => { srv.last = { url: req.url, key: req.headers["x-goog-api-key"], body: JSON.parse(b) }; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(srv.resp)); }); });
await new Promise((r) => srv.listen(0, r)); const port = srv.address().port;
const run = (env) => new Promise((resolve) => { import("node:child_process").then(({ spawn }) => { const p = spawn("node", ["--import", "data:text/javascript,globalThis.__f=globalThis.fetch;globalThis.fetch=(u,o)=>globalThis.__f(String(u).replace('https://generativelanguage.googleapis.com','http://localhost:" + port + "'),o)", "scripts/refresh-market.mjs"], { env: { ...process.env, ...env } }); let o = ""; p.stdout.on("data", (d) => o += d); p.stderr.on("data", (d) => o += d); p.on("close", (c) => resolve({ c, o })); }); });
const dir = mkdtempSync(join(tmpdir(), "mm-")), file = join(dir, "market.json");
srv.resp = { candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(good) + "\n```" }] } }] };
let r = await run({ GEMINI_API_KEY: "k123", MARKET_FILE: file }); assert.equal(r.c, 0, r.o);
let d = JSON.parse(readFileSync(file, "utf8")); assert.equal(d.usd.b, 141); assert.equal(d.by, "gemini-actions"); assert.equal(srv.last.key, "k123"); assert.ok(srv.last.body.tools[0].google_search); assert.ok(srv.last.url.includes("gemini-2.5-flash")); ok++; console.log("✔ السكربت يكتب data/market.json بعد بحث Gemini");
const ts1 = d.ts; srv.resp = { candidates: [{ content: { parts: [{ text: JSON.stringify({ ...good, usd: { b: 14100, s: 14175 }, g21: { b: 1, s: 2 } }) }] } }] };
await new Promise((x) => setTimeout(x, 5)); r = await run({ GEMINI_API_KEY: "k123", MARKET_FILE: file }); d = JSON.parse(readFileSync(file, "utf8"));
assert.equal(d.usd.b, 141); assert.equal(d.ts, ts1); assert.ok(d.notes.length >= 2); ok++; console.log("✔ أسعار خاطئة كلها: يبقى السابق ولا يتجدد الوقت");
srv.resp = { candidates: [{ content: { parts: [{ text: JSON.stringify({ ...good, usd: { b: 14100, s: 14175 }, g21: { b: 16500, s: 16700 } }) }] } }] };
await new Promise((x) => setTimeout(x, 5)); await run({ GEMINI_API_KEY: "k123", MARKET_FILE: file }); d = JSON.parse(readFileSync(file, "utf8"));
assert.equal(d.usd.b, 141); assert.equal(d.g21.b, 16500); assert.notEqual(d.ts, ts1); ok++; console.log("✔ قبول جزئي: الذهب يتجدد والدولار المرفوض يبقى");
srv.resp = { error: { message: "bad" } }; srv.close(); console.log(`\n${ok} اختبارًا نجحت`); process.exit(0);
