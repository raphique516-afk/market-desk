# Market Desk

Henrique's portfolio desk as an installable web app (open in Safari → Share → Add to Home Screen).

- `index.html` + `data.enc.json` are the published site. The data is encrypted (PBKDF2 + AES-GCM); it only opens with the owner's passphrase.
- `tools/` holds the build: `DESK_PASS=... node tools/build.mjs <dump-dir> tools/template.html .`
- A scheduled Claude task refreshes `data.enc.json` every hour on B3 trading days.

## Backups

Three copies, all encrypted with the owner's passphrase:
1. The live data in the Claude artifact.
2. Every published `data.enc.json` in this repo's git history (one version per hourly refresh).
3. `backup-core.enc.json` (positions, notes, agent briefing, memory, call history) copied weekly to Google Drive, folder "Market Desk backups".

Restore: `DESK_PASS=... node tools/decrypt.mjs <file.enc.json> restored.json`, then ask Claude to load `restored.json` back into the artifact.
