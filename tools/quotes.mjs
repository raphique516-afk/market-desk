// Live quote feed for the Market Desk app. Run by .github/workflows/quotes.yml every 15 minutes in B3 hours.
// Reads tickers.json (written by build.mjs) and writes quotes.json with the latest price of each ticker.
// Source: Yahoo Finance chart API (<TICKER>.SA, ~15 min delay); fallback: Google Finance quote page.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const tickers = JSON.parse(readFileSync("tickers.json", "utf8"));
const prev = existsSync("quotes.json") ? JSON.parse(readFileSync("quotes.json", "utf8")) : { quotes: {} };
const spDay = ms => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const round = (x, n) => Math.round(x * 10 ** n) / 10 ** n;

async function yahoo(t) {
  for (const host of ["query1", "query2"]) {
    const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${t}.SA?range=1d&interval=5m`, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;
    const m = (await r.json())?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice, prevClose = m?.chartPreviousClose ?? m?.previousClose;
    if (!(price > 0) || !(prevClose > 0)) continue;
    const at = (m.regularMarketTime || 0) * 1000;
    return { price: round(price, 2), chgPct: round((price / prevClose - 1) * 100, 2), prevClose: round(prevClose, 2), day: spDay(at), at, src: "Yahoo Finance" };
  }
  return null;
}

async function google(t) {
  const r = await fetch(`https://www.google.com/finance/quote/${t}:BVMF?hl=en`, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!r.ok) return null;
  const h = await r.text();
  const price = +(h.match(/data-last-price="([\d.]+)"/) || [])[1];
  const ts = +(h.match(/data-last-normal-market-timestamp="(\d+)"/) || [])[1];
  const pc = +((h.match(/Previous close<\/div>[\s\S]{0,400}?R\$\s?([\d.,]+)/) || [])[1] || "").replace(/,/g, "");
  if (!(price > 0)) return null;
  const at = ts ? ts * 1000 : Date.now();
  return { price: round(price, 2), chgPct: pc > 0 ? round((price / pc - 1) * 100, 2) : null, prevClose: pc > 0 ? round(pc, 2) : null, day: spDay(at), at, src: "Google Finance" };
}

const quotes = { ...(prev.quotes || {}) };
const failed = [];
for (const t of tickers) {
  let q = null;
  try { q = await yahoo(t); } catch {}
  if (!q) { try { q = await google(t); } catch {} }
  if (q) quotes[t] = { ...q, live: true }; else failed.push(t);
  await new Promise(r => setTimeout(r, 400));
}
for (const t of Object.keys(quotes)) if (!tickers.includes(t)) delete quotes[t];
const out = { quotes, updatedAt: Date.now(), failed };
writeFileSync("quotes.json", JSON.stringify(out, null, 1) + "\n");
console.log(`quotes.json: ${tickers.length - failed.length}/${tickers.length} priced${failed.length ? "; failed " + failed.join(", ") : ""}`);
if (failed.length === tickers.length) process.exit(1);
