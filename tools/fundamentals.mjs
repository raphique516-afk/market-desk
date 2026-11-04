// Company facts from B3's public listed-companies service: share capital composition and cash dividends.
// Writes fundamentals.json. Run weekly by .github/workflows/fundamentals.yml (and on changes to this file).
import { readFileSync, writeFileSync } from "node:fs";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const tickers = JSON.parse(readFileSync("tickers.json", "utf8"));
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64");
const BASE = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall";
async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 100)}`);
  try { return JSON.parse(t); } catch { throw new Error(`not JSON: ${t.slice(0, 100)}`); }
}
const out = { updatedAt: Date.now(), companies: {} };
for (const t of tickers) {
  const code = t.slice(0, 4);
  const c = out.companies[t] = { issuer: code };
  try {
    let sup = await get(`${BASE}/GetListedSupplementCompany/${b64({ issuingCompany: code, language: "pt-br" })}`);
    if (typeof sup === "string") sup = JSON.parse(sup);
    const s = Array.isArray(sup) ? sup[0] : sup;
    const n = v => v == null || v === "" ? null : +String(v).replace(/\./g, "").replace(",", ".");
    c.shares = { common: n(s?.numberCommonShares), preferred: n(s?.numberPreferredShares), total: n(s?.totalNumberShares) };
    c.cashDividends = (s?.cashDividends || []).slice(0, 40).map(d => ({ type: d.label, approved: d.approvedOn, lastDateWith: d.lastDatePrior, paid: d.paymentDate, perShare: n(d.rate), isin: d.isinCode, relatedTo: d.relatedTo }));
    c.keys = Object.keys(s || {});
  } catch (e) { c.error = String(e.message || e); }
  await new Promise(r => setTimeout(r, 500));
}
writeFileSync("fundamentals.json", JSON.stringify(out, null, 1) + "\n");
console.log(Object.entries(out.companies).map(([t, c]) => `${t}: ${c.error || (c.shares?.total ?? "?") + " shares, " + (c.cashDividends?.length || 0) + " dividends"}`).join("\n"));
