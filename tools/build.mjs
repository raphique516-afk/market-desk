// Builds the standalone Market Desk site.
// Usage: DESK_PASS=... node build.mjs <dumpDir> <template.html> <outDir>
//   dumpDir   folder written by ArtifactData reads with out_dir (contains data/users/me/...)
//   template  the Market Desk artifact HTML (market-desk.html)
//   outDir    where index.html and data.enc.json are written
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { webcrypto as crypto } from "node:crypto";

const [dumpDir, templatePath, outDir] = process.argv.slice(2);
const pass = process.env.DESK_PASS;
if (!dumpDir || !templatePath || !outDir || !pass) {
  console.error("Usage: DESK_PASS=... node build.mjs <dumpDir> <template.html> <outDir>");
  process.exit(1);
}
const me = join(dumpDir, "data/users/me");
const readDir = d => existsSync(d) ? readdirSync(d).filter(f => f.endsWith(".json")).map(f => ({ id: f.replace(/\.json$/, ""), ...JSON.parse(readFileSync(join(d, f), "utf8")) })) : [];
const readDoc = n => { const f = join(me, n + ".json"); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };

const snapshot = {
  builtAt: Date.now(),
  holdings: readDir(join(me, "desk/holdings")),
  reports: readDir(join(me, "desk/reports")),
  deep: readDir(join(me, "desk/deep")),
  history: readDir(join(me, "desk/history")),
  docs: Object.fromEntries(["agent", "macro", "quotes", "newsfeed", "memory"].map(n => [n, readDoc(n)]))
};

// Encrypt: PBKDF2-SHA256 (250k) -> AES-GCM 256
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(snapshot))));
const b64 = u => Buffer.from(u).toString("base64");
mkdirSync(outDir, { recursive: true });
// Tickers for the live quote feed (.github/workflows/quotes.yml). Only B3 tickers; positions and amounts stay encrypted.
writeFileSync(join(outDir, "tickers.json"), JSON.stringify(snapshot.holdings.filter(h => (h.currency || "BRL") === "BRL").map(h => h.label).sort()) + "\n");
writeFileSync(join(outDir, "data.enc.json"), JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct), builtAt: snapshot.builtAt }));

// Compact off-site backup: everything that cannot be re-collected (positions, notes, briefing, memory,
// history, deep dives) plus the list of research files without their text, which can be fetched again.
const core = { ...snapshot, reports: snapshot.reports.map(({ text, ...meta }) => meta) };
const iv2 = crypto.getRandomValues(new Uint8Array(12));
const ct2 = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv2 }, key, enc.encode(JSON.stringify(core))));
writeFileSync(join(outDir, "backup-core.enc.json"), JSON.stringify({ v: 1, kind: "core", salt: b64(salt), iv: b64(iv2), ct: b64(ct2), builtAt: snapshot.builtAt }));

// Page: the artifact's UI started after the snapshot is unlocked.
let page = readFileSync(templatePath, "utf8");
const start = "<script>\n(() => {\n\"use strict\";";
if (!page.includes(start) || !page.trimEnd().endsWith("})();\n</script>")) throw new Error("template script markers not found");
page = page.replace(start, "<script>\nwindow.__startDesk = () => {\n\"use strict\";");
page = page.replace(/\}\)\(\);\n<\/script>\s*$/, "};\n</script>\n");
const shim = readFileSync(new URL("./shim.html", import.meta.url), "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Market Desk"><meta name="theme-color" content="#0e1a2b">
<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-180.png"><link rel="icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${shim}${page}</body></html>`;
writeFileSync(join(outDir, "index.html"), html.replace("</body></html>", `<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});</script></body></html>`));
for (const f of ["manifest.webmanifest", "sw.js", "icon-180.png", "icon-192.png", "icon-512.png"]) writeFileSync(join(outDir, f), readFileSync(new URL("./" + f, import.meta.url)));
console.log(`Built ${outDir}: ${snapshot.holdings.length} positions, ${snapshot.reports.length} reports, agent ${snapshot.docs.agent ? "yes" : "no"}`);
