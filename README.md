# Luma — Personal OS

A personal finance and life-admin app: transactions, accounts, investments, SIPs, liabilities,
udhaar (money lent), tasks, notes and documents — with an AI assistant, voice input and
documents stored in Google Drive.

Google Sheets is the database, Google Apps Script is the API, and a React web app is the UI.

```
Luma_web_app/
├── web/           React 19 + TypeScript + Vite + Tailwind — the app
└── apps-script/   Google Apps Script — the API over the Google Sheet (and Drive / Azure AI)
```

## How it fits together

```
Browser (web/)  ──GET/POST──▶  Apps Script web app (apps-script/)  ──▶  Google Sheet (data)
                                                                   ├─▶  Google Drive  ("Luma Documents")
                                                                   └─▶  Azure OpenAI + Azure Speech
```

- **Reads** go through one `?action=bootstrap` request on first load, then per-collection
  routes; results are shared app-wide and cached in the browser (`web/src/lib/remoteStore.ts`).
- **Writes** are POSTs. Records are soft-deleted (archive / void) or permanently deleted with a
  copy kept in a *Deleted Records* sheet.
- **Documents** live in a `Luma Documents` folder in Google Drive (nested folders; the
  *Documents* sheet keeps each file's link, tags and expiry date).
- **AI**: the assistant and "tell Luma what happened" quick-add call Azure OpenAI through Apps
  Script; the mic uses Azure Speech with short-lived tokens. Keys never reach the browser.

## Setup

### 1. Apps Script (`apps-script/`)

1. Install clasp and sign in: `npm i -g @google/clasp && clasp login`.
2. Put your own script id in `apps-script/.clasp.json`, then `clasp push`.
3. In the Apps Script editor → **Project Settings → Script Properties**, add:

   | Property | Value |
   |---|---|
   | `AZURE_OPENAI_ENDPOINT` | `https://<resource>.openai.azure.com/` |
   | `AZURE_OPENAI_DEPLOYMENT` | e.g. `gpt-4o-mini` |
   | `AZURE_OPENAI_KEY` | your key |
   | `AZURE_SPEECH_KEY` | your key |
   | `AZURE_SPEECH_REGION` | e.g. `eastus` |

4. Run once from the editor: `setupLumaSheets()`, `setupLumaLifecycle()`, `checkLumaAI()`,
   `checkLumaDrive()` (these also trigger Google's permission prompts).
5. **Deploy → New deployment → Web app** (execute as *me*). After later changes:
   `clasp push`, then **Manage deployments → Edit → New version**.

### 2. Web app (`web/`)

```bash
cd web
npm install
cp .env.example .env   # set VITE_GOOGLE_SHEETS_API_URL to your web app's /exec URL
npm run dev
```

`npm run build` type-checks and builds; `npm run lint` runs oxlint.

## Security notes

- **Passcode gate** (`apps-script/Luma_Auth.js`): fail-closed — as soon as `LUMA_PASSCODE` is set in
  Script Properties, every request needs a signed session token from signing in
  (`LUMA_AUTH_ENFORCE=false` is an emergency off switch only). Sessions last **2 hours** on every
  device; the app then signs out by itself and wipes its cached copy of the data. 10 wrong attempts
  lock sign-in for 15 minutes. Settings → Security has sign-out and "sign out everywhere".
  Setup order: set the passcode → run `setupLumaAuth()` → add the printed key to the iPhone
  Shortcut → deploy.
- **Vault** (`apps-script/Luma_Vault.js`, `web/src/lib/vaultCrypto.ts`): passwords, cards, bank
  details and IDs are encrypted in the browser (AES-256-GCM, key from a master password via
  PBKDF2-SHA256, 600k iterations). The script and the hidden `Vault` sheet only hold ciphertext;
  the master password can't be recovered (forgetting it means erasing the vault). The vault locks
  after 5 idle minutes and whenever the session ends, and is never sent to the AI assistant.
- The Vercel deployment sends security headers (`web/vercel.json`): a strict Content Security
  Policy, no framing, no referrer, no search indexing.
- The **iPhone Shortcut** sends `"key": "<LUMA_SHORTCUT_KEY>"` in its JSON; that key can only add a
  transaction or an udhaar entry.
- `.env` (the Apps Script web app URL) is git-ignored. It still ends up in the built JavaScript, so
  the passcode gate — not secrecy of the URL — is what protects the data.
- Azure keys and the passcode live only in Apps Script **Script Properties**, never in this repository.
- Drive operations are confined to the `Luma Documents` folder, "delete" moves files to Drive's
  trash, and AI/Drive calls are rate-limited per hour.

## History

`web/` and `apps-script/` were developed as two repositories and merged here with their full
commit histories (`git log -- web/` or `git log -- apps-script/`).
