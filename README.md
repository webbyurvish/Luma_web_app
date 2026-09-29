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

- **Passcode gate** (`apps-script/Luma_Auth.js`): with `LUMA_PASSCODE` and `LUMA_AUTH_ENFORCE=true`
  set in Script Properties, every request needs a signed, expiring session token from signing in;
  the web app shows a sign-in screen. 10 wrong attempts lock sign-in for 15 minutes. Settings →
  Security has sign-out and "sign out everywhere". Setup order: set the passcode → run
  `setupLumaAuth()` → deploy and sign in → add the printed key to the iPhone Shortcut → enforce.
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
