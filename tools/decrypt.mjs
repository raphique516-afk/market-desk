// Opens a Market Desk backup (data.enc.json or a dated backup copy) and writes the plain data.
// Usage: DESK_PASS=... node tools/decrypt.mjs <backup.enc.json> <out.json>
// The output is the full snapshot: positions, research library, agent briefing, memory and history.
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const [inPath, outPath] = process.argv.slice(2);
const pass = process.env.DESK_PASS;
if (!inPath || !outPath || !pass) { console.error("Usage: DESK_PASS=... node tools/decrypt.mjs <backup.enc.json> <out.json>"); process.exit(1); }
const box = JSON.parse(readFileSync(inPath, "utf8"));
const b64 = s => Uint8Array.from(Buffer.from(s, "base64"));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(box.salt), iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
let plain;
try { plain = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(box.iv) }, key, b64(box.ct))); }
catch { console.error("Wrong passphrase or damaged file."); process.exit(2); }
writeFileSync(outPath, plain);
const s = JSON.parse(plain);
console.log(`Restored snapshot from ${new Date(s.builtAt).toISOString()}: ${s.holdings.length} positions, ${s.reports.length} reports.`);
