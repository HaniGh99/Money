// يشغَّل من GitHub Actions: يبحث Gemini في الويب، يتحقق من الأرقام، ثم يكتب data/market.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseJSON, validateMarket, MARKET_PROMPT } from "./market-lib.mjs";
const FILE = process.env.MARKET_FILE || "data/market.json", key = process.env.GEMINI_API_KEY;
if (!key) { console.log("GEMINI_API_KEY غير مضبوط: تخطّي التحديث."); process.exit(0); }
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const prev = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : null;
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" },
  body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: MARKET_PROMPT() }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 8000, temperature: 0.2 } }) });
const j = await r.json(); if (!r.ok) { console.error("gemini", r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }
const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((p) => p.text || "").join("");
let n; try { n = parseJSON(text); } catch (e) { console.error("رد غير صالح:", e.message); process.exit(1); }
const v = validateMarket(n, prev), now = new Date().toISOString(), fresh = v.updated; delete v.updated;
const doc = { ...v, ts: fresh || !prev ? now : prev.ts, advTs: now, by: "gemini-actions", src: "sp-today.com" };
writeFileSync(FILE, JSON.stringify(doc, null, 1) + "\n"); console.log("updated", doc.ts, doc.notes);
