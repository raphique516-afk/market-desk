# Market Desk

Henrique's portfolio desk as an installable web app (open in Safari → Share → Add to Home Screen).

- `index.html` + `data.enc.json` are the published site. The data is encrypted (PBKDF2 + AES-GCM); it only opens with the owner's passphrase.
- `tools/` holds the build: `DESK_PASS=... node tools/build.mjs <dump-dir> tools/template.html .`
- A scheduled Claude task refreshes `data.enc.json` every hour on B3 trading days.
